require("dotenv").config();

const mongoose = require("mongoose");
const app = require("./src/app");
const connectToDB = require("./src/config/db");
const { validateEnv } = require("./src/config/env");

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function start() {
  validateEnv();
  await connectToDB();

  const port = Number(process.env.PORT) || 3000;
  const server = app.listen(port, () => {
    console.log(`Backend Ledger listening on port ${port}`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received; shutting down gracefully.`);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start().catch((error) => {
  console.error("Application startup failed:", error.message);
  process.exit(1);
});
