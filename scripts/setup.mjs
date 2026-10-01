import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
for (const pasta of ["api", "app-contatos"]) {
  const destination = new URL(`${pasta}/.env`, root);
  if (existsSync(destination)) {
    console.log(`${pasta}/.env já existe; preservado.`);
    continue;
  }
  let content = readFileSync(new URL(`${pasta}/.env.example`, root), "utf8");
  if (pasta === "api")
    content = content.replace(
      "JWT_SECRET=\n",
      `JWT_SECRET=${randomBytes(48).toString("hex")}\n`,
    );
  writeFileSync(destination, content, { mode: 0o600 });
  console.log(`Criado: ${fileURLToPath(destination)}`);
}
