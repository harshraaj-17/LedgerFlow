const express = require("express");
const cookieParser = require("cookie-parser");

const authRouter = require("./routes/auth.routes");
const accountRouter = require("./routes/account.routes");
const transactionRouter = require("./routes/transaction.routes");
const { notFoundHandler, errorHandler } = require("./middleware/error.middleware");

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));
app.use(cookieParser());

app.get("/", (req, res) => res.status(200).json({ message: "Ledger Service is up and running" }));
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

app.use("/api/auth", authRouter);
app.use("/api/accounts", accountRouter);
app.use("/api/transactions", transactionRouter);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
