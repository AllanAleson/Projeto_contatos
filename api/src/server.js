import { MongoClient } from "mongodb";
import { createApp } from "./app.js";
const client = new MongoClient(
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/contatos",
  { serverSelectionTimeoutMS: 10000 },
);
try {
  await client.connect();
  const app = await createApp({
    db: client.db(),
    jwtSecret: process.env.JWT_SECRET,
    origins: (
      process.env.CORS_ORIGINS || "http://localhost:8081,http://localhost:19006"
    )
      .split(",")
      .map((value) => value.trim()),
  });
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, "0.0.0.0", () =>
    console.log(`API de contatos em http://localhost:${port}`),
  );
  const stop = () =>
    server.close(async () => {
      await client.close();
      process.exit(0);
    });
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
} catch (err) {
  console.error("Não foi possível iniciar a API:", err.message);
  await client.close();
  process.exit(1);
}
