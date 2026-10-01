import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
let mongo, client, app, token, outroToken, contatoId, fotoId;
const secret = "test-only-secret-with-at-least-32-characters";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO9sAAAAASUVORK5CYII=",
  "base64",
);
const auth = () => ({ Authorization: `Bearer ${token}` });
before(async () => {
  mongo = await MongoMemoryServer.create();
  client = await MongoClient.connect(mongo.getUri());
  app = await createApp({
    db: client.db("teste"),
    jwtSecret: secret,
    authLimit: 100,
  });
});
after(async () => {
  await client?.close();
  await mongo?.stop();
});
test("rotas privadas rejeitam acesso sem JWT", async () => {
  await request(app).get("/contatos").expect(401);
  await request(app).post("/upload").expect(401);
});
test("cadastro valida os campos, esconde hash e rejeita e-mail duplicado", async () => {
  await request(app)
    .post("/usuarios/registrar")
    .send({ nome: "", email: "errado", senha: "1" })
    .expect(400);
  const response = await request(app)
    .post("/usuarios/registrar")
    .send({ nome: "Ana", email: "ANA@EXEMPLO.COM", senha: "senha12345" })
    .expect(201);
  assert.equal(response.body.usuario.email, "ana@exemplo.com");
  assert.equal(response.body.usuario.senhaHash, undefined);
  await request(app)
    .post("/usuarios/registrar")
    .send({ nome: "Ana 2", email: "ana@exemplo.com", senha: "senha12345" })
    .expect(409);
});
test("login autentica e rejeita senha incorreta", async () => {
  await request(app)
    .post("/usuarios/login")
    .send({ email: "ana@exemplo.com", senha: "incorreta" })
    .expect(401);
  const response = await request(app)
    .post("/usuarios/login")
    .send({ email: "ana@exemplo.com", senha: "senha12345" })
    .expect(200);
  token = response.body.token;
  assert.ok(token);
  const me = await request(app).get("/usuarios/me").set(auth()).expect(200);
  assert.equal(me.body.nome, "Ana");
  await request(app)
    .post("/usuarios/registrar")
    .send({ nome: "Bruno", email: "bruno@exemplo.com", senha: "senha12345" })
    .expect(201);
  outroToken = (
    await request(app)
      .post("/usuarios/login")
      .send({ email: "bruno@exemplo.com", senha: "senha12345" })
      .expect(200)
  ).body.token;
});
test("JWT expirado e adulterado são rejeitados", async () => {
  const expired = jwt.sign({}, secret, {
    subject: jwt.decode(token).sub,
    expiresIn: -1,
    issuer: "contatos-api",
    audience: "app-contatos",
  });
  await request(app)
    .get("/contatos")
    .set("Authorization", `Bearer ${expired}`)
    .expect(401);
  await request(app)
    .get("/contatos")
    .set("Authorization", `Bearer ${token}errado`)
    .expect(401);
});
test("CRUD cria, lista e consulta contato sem foto", async () => {
  await request(app)
    .post("/contatos")
    .set(auth())
    .send({ nome: " " })
    .expect(400);
  const created = await request(app)
    .post("/contatos")
    .set(auth())
    .send({ nome: "Maria", telefone: "11999999999" })
    .expect(201);
  contatoId = created.body._id;
  assert.equal(created.body.usuarioId, undefined);
  assert.equal(created.body.fotoId, null);
  const list = await request(app).get("/contatos").set(auth()).expect(200);
  assert.equal(list.body.length, 1);
  const get = await request(app)
    .get(`/contatos/${contatoId}`)
    .set(auth())
    .expect(200);
  assert.equal(get.body.nome, "Maria");
  await request(app).get("/contatos/id-invalido").set(auth()).expect(400);
});
test("outro usuário não lista, lê, altera nem exclui o contato", async () => {
  const otherAuth = { Authorization: `Bearer ${outroToken}` };
  const list = await request(app).get("/contatos").set(otherAuth).expect(200);
  assert.deepEqual(list.body, []);
  await request(app).get(`/contatos/${contatoId}`).set(otherAuth).expect(404);
  await request(app)
    .put(`/contatos/${contatoId}`)
    .set(otherAuth)
    .send({ nome: "Inválido" })
    .expect(404);
  await request(app)
    .delete(`/contatos/${contatoId}`)
    .set(otherAuth)
    .expect(404);
});
test("upload valida o conteúdo e o limite de tamanho", async () => {
  await request(app).post("/upload").set(auth()).expect(400);
  await request(app)
    .post("/upload")
    .set(auth())
    .attach("foto", Buffer.from("não é imagem"), {
      filename: "falsa.png",
      contentType: "image/png",
    })
    .expect(415);
  await request(app)
    .post("/upload")
    .set(auth())
    .attach("foto", Buffer.alloc(5 * 1024 * 1024 + 1), "grande.png")
    .expect(400);
});
test("GridFS salva imagem, entrega os mesmos bytes e protege por dono", async () => {
  const upload = await request(app)
    .post("/upload")
    .set(auth())
    .attach("foto", png, { filename: "foto.png", contentType: "image/png" })
    .expect(201);
  fotoId = upload.body.fileId;
  const image = await request(app)
    .get(`/upload/${fotoId}`)
    .set(auth())
    .expect(200);
  assert.deepEqual(image.body, png);
  await request(app).get(`/upload/${fotoId}`).expect(401);
  await request(app)
    .get(`/upload/${fotoId}`)
    .set("Authorization", `Bearer ${outroToken}`)
    .expect(404);
  await request(app)
    .post("/contatos")
    .set("Authorization", `Bearer ${outroToken}`)
    .send({ nome: "Teste", fotoId })
    .expect(400);
});
test("edição associa foto; null remove; foto em uso não pode ser apagada", async () => {
  const updated = await request(app)
    .put(`/contatos/${contatoId}`)
    .set(auth())
    .send({ nome: "Maria Silva", email: "maria@exemplo.com", fotoId })
    .expect(200);
  assert.equal(updated.body.fotoId, fotoId);
  assert.equal(updated.body.nome, "Maria Silva");
  await request(app).delete(`/upload/${fotoId}`).set(auth()).expect(409);
  const removed = await request(app)
    .put(`/contatos/${contatoId}`)
    .set(auth())
    .send({ nome: "Maria Silva", fotoId: null })
    .expect(200);
  assert.equal(removed.body.fotoId, null);
  await request(app).delete(`/upload/${fotoId}`).set(auth()).expect(204);
  await request(app).get(`/upload/${fotoId}`).set(auth()).expect(404);
});
test("exclusão remove contato e lista fica vazia", async () => {
  await request(app).delete(`/contatos/${contatoId}`).set(auth()).expect(204);
  await request(app).get(`/contatos/${contatoId}`).set(auth()).expect(404);
  assert.deepEqual(
    (await request(app).get("/contatos").set(auth()).expect(200)).body,
    [],
  );
});
