import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { GridFSBucket, ObjectId } from "mongodb";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileTypeFromBuffer } from "file-type";
import { z } from "zod";

const email = z
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
const cadastroSchema = z
  .object({
    nome: z.string().trim().min(1).max(100),
    email: z.string().trim().pipe(email),
    senha: z
      .string()
      .min(8)
      .max(72)
      .refine(
        (value) => Buffer.byteLength(value) <= 72,
        "Senha excede 72 bytes.",
      ),
  })
  .strict();
const loginSchema = z
  .object({
    email: z.string().trim().pipe(email),
    senha: z.string().min(1).max(200),
  })
  .strict();
const contatoSchema = z
  .object({
    nome: z.string().trim().min(1).max(120),
    email: z
      .union([z.literal(""), z.string().trim().pipe(email)])
      .optional()
      .default(""),
    telefone: z.string().trim().max(40).optional().default(""),
    endereco: z.string().trim().max(300).optional().default(""),
    // null é explícito: undefined desaparece durante JSON.stringify e não remove a foto.
    fotoId: z
      .string()
      .regex(/^[a-f\d]{24}$/i)
      .nullable()
      .optional()
      .default(null),
  })
  .strict();
const invalid = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const objectId = (value) => {
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value))
    throw invalid("ID inválido.");
  return new ObjectId(value);
};
const usuarioPublico = (user) => ({
  _id: user._id,
  nome: user.nome,
  email: user.email,
});
const contatoPublico = ({ usuarioId, ...contato }) => contato;

export async function createApp({
  db,
  jwtSecret,
  origins = ["http://localhost:8081"],
  authLimit = 30,
}) {
  if (!jwtSecret || jwtSecret.length < 32)
    throw new Error("JWT_SECRET precisa ter pelo menos 32 caracteres.");
  const usuarios = db.collection("usuarios");
  const contatos = db.collection("contatos");
  const bucket = new GridFSBucket(db, { bucketName: "fotos" });
  await usuarios.createIndex({ email: 1 }, { unique: true });
  await contatos.createIndex({ usuarioId: 1, nome: 1 });
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, !origin || origins.includes(origin));
      },
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use(
    "/usuarios",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: authLimit,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        mensagem: "Muitas tentativas. Tente novamente em 15 minutos.",
      },
    }),
  );

  app.post("/usuarios/registrar", async (req, res) => {
    const dados = cadastroSchema.parse(req.body);
    const senhaHash = await bcrypt.hash(dados.senha, 12);
    const usuario = {
      nome: dados.nome,
      email: dados.email,
      senhaHash,
      criadoEm: new Date(),
    };
    const { insertedId } = await usuarios.insertOne(usuario);
    res
      .status(201)
      .json({
        mensagem: "Conta criada.",
        usuario: usuarioPublico({ ...usuario, _id: insertedId }),
      });
  });
  app.post("/usuarios/login", async (req, res) => {
    const dados = loginSchema.parse(req.body);
    const usuario = await usuarios.findOne({ email: dados.email });
    if (!usuario || !(await bcrypt.compare(dados.senha, usuario.senhaHash)))
      throw invalid("E-mail ou senha incorretos.", 401);
    const token = jwt.sign({}, jwtSecret, {
      algorithm: "HS256",
      subject: usuario._id.toHexString(),
      expiresIn: "7d",
      issuer: "contatos-api",
      audience: "app-contatos",
    });
    res.json({ token, usuario: usuarioPublico(usuario) });
  });

  // Todas as rotas abaixo exigem JWT e filtram os documentos pelo dono.
  app.use(async (req, _res, next) => {
    const bearer = req.headers.authorization;
    if (!bearer?.startsWith("Bearer "))
      throw invalid("Faça login para continuar.", 401);
    try {
      const payload = jwt.verify(bearer.slice(7), jwtSecret, {
        algorithms: ["HS256"],
        issuer: "contatos-api",
        audience: "app-contatos",
      });
      req.usuarioId = objectId(payload.sub);
    } catch {
      throw invalid("Sessão expirada. Entre novamente.", 401);
    }
    if (
      !(await usuarios.findOne(
        { _id: req.usuarioId },
        { projection: { _id: 1 } },
      ))
    )
      throw invalid("Usuário não encontrado.", 401);
    next();
  });
  app.get("/usuarios/me", async (req, res) =>
    res.json(usuarioPublico(await usuarios.findOne({ _id: req.usuarioId }))),
  );
  const filtro = (req) => ({
    _id: objectId(req.params.id),
    usuarioId: req.usuarioId,
  });
  const validarFoto = async (fotoId, usuarioId) => {
    if (
      fotoId &&
      !(await db
        .collection("fotos.files")
        .findOne({ _id: objectId(fotoId), "metadata.usuarioId": usuarioId }))
    )
      throw invalid("Foto não encontrada para este usuário.");
  };
  app.get("/contatos", async (req, res) =>
    res.json(
      (
        await contatos
          .find({ usuarioId: req.usuarioId })
          .sort({ nome: 1 })
          .toArray()
      ).map(contatoPublico),
    ),
  );
  app.get("/contatos/:id", async (req, res) => {
    const contato = await contatos.findOne(filtro(req));
    if (!contato) throw invalid("Contato não encontrado.", 404);
    res.json(contatoPublico(contato));
  });
  app.post("/contatos", async (req, res) => {
    const dados = contatoSchema.parse(req.body);
    await validarFoto(dados.fotoId, req.usuarioId);
    const contato = {
      ...dados,
      usuarioId: req.usuarioId,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    };
    const { insertedId } = await contatos.insertOne(contato);
    res.status(201).json(contatoPublico({ ...contato, _id: insertedId }));
  });
  app.put("/contatos/:id", async (req, res) => {
    const dados = contatoSchema.parse(req.body);
    await validarFoto(dados.fotoId, req.usuarioId);
    const contato = await contatos.findOneAndUpdate(
      filtro(req),
      { $set: { ...dados, atualizadoEm: new Date() } },
      { returnDocument: "after" },
    );
    if (!contato) throw invalid("Contato não encontrado.", 404);
    res.json(contatoPublico(contato));
  });
  app.delete("/contatos/:id", async (req, res) => {
    if (!(await contatos.deleteOne(filtro(req))).deletedCount)
      throw invalid("Contato não encontrado.", 404);
    res.status(204).end();
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
  });
  app.post("/upload", upload.single("foto"), async (req, res) => {
    if (!req.file) throw invalid("Envie a imagem no campo foto.");
    // Valida os bytes: não confia apenas no MIME informado pelo cliente.
    const tipo = await fileTypeFromBuffer(req.file.buffer);
    if (!tipo || !["image/jpeg", "image/png", "image/webp"].includes(tipo.mime))
      throw invalid("Use uma imagem JPG, PNG ou WebP.", 415);
    const stream = bucket.openUploadStream(`foto.${tipo.ext}`, {
      metadata: { usuarioId: req.usuarioId, contentType: tipo.mime },
    });
    await pipeline(Readable.from(req.file.buffer), stream);
    res.status(201).json({ fileId: stream.id.toHexString() });
  });
  app.get("/upload/:id", async (req, res) => {
    const id = objectId(req.params.id);
    const arquivo = await db
      .collection("fotos.files")
      .findOne({ _id: id, "metadata.usuarioId": req.usuarioId });
    if (!arquivo) throw invalid("Foto não encontrada.", 404);
    res
      .type(arquivo.metadata.contentType)
      .set("Cache-Control", "private, no-store");
    await pipeline(bucket.openDownloadStream(id), res);
  });
  // Permite descartar uploads ainda não associados, sem apagar fotos em uso.
  app.delete("/upload/:id", async (req, res) => {
    const id = objectId(req.params.id);
    if (
      !(await db
        .collection("fotos.files")
        .findOne({ _id: id, "metadata.usuarioId": req.usuarioId }))
    )
      throw invalid("Foto não encontrada.", 404);
    if (
      await contatos.findOne({
        fotoId: id.toHexString(),
        usuarioId: req.usuarioId,
      })
    )
      throw invalid("A foto ainda está em uso.", 409);
    await bucket.delete(id);
    res.status(204).end();
  });
  app.use((_req, res) =>
    res.status(404).json({ mensagem: "Rota não encontrada." }),
  );
  app.use((err, _req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof z.ZodError)
      return res
        .status(400)
        .json({
          mensagem: "Verifique os campos preenchidos.",
          campos: err.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensagem: issue.message,
          })),
        });
    if (err.code === 11000)
      return res
        .status(409)
        .json({ mensagem: "Este e-mail já está cadastrado." });
    if (err instanceof multer.MulterError)
      return res
        .status(400)
        .json({
          mensagem:
            err.code === "LIMIT_FILE_SIZE"
              ? "A foto deve ter até 5 MB."
              : "Envie apenas uma imagem no campo foto.",
        });
    const status = err.status || 500;
    if (status >= 500) console.error("Erro na API:", err.message);
    res
      .status(status)
      .json({
        mensagem:
          status >= 500 ? "Erro interno. Tente novamente." : err.message,
      });
  });
  return app;
}
