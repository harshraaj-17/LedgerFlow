const asyncHandler = require("../middleware/async-handler");
const transactionService = require("../services/transaction.service");
const emailService = require("../services/email.service");
const { validateTransfer, validateDeposit } = require("../utils/validators");

const VALID_STATUSES = ["PENDING", "COMPLETED", "FAILED", "REVERSED"];
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const createTransaction = asyncHandler(async (req, res) => {
  const { error, value } = validateTransfer(req.body);
  if (error) return res.status(400).json({ message: error });

  const { transaction, replayed } = await transactionService.transferFunds({
    user: req.user,
    ...value,
  });

  if (replayed) {
    return res.status(200).json({ message: "Transaction already processed", transaction });
  }

  // Best-effort notification, deliberately outside the database transaction.
  void emailService.sendTransactionEmail(
    req.user.email,
    req.user.name,
    transaction.amount,
    transaction.toAccount,
    transaction.currency
  );

  return res.status(201).json({ message: "Transaction completed successfully", transaction });
});

const createInitialFundsTransaction = asyncHandler(async (req, res) => {
  const { error, value } = validateDeposit(req.body);
  if (error) return res.status(400).json({ message: error });

  const { transaction, replayed } = await transactionService.creditInitialFunds({
    systemUser: req.user,
    ...value,
  });

  if (replayed) {
    return res.status(200).json({ message: "Transaction already processed", transaction });
  }
  return res.status(201).json({ message: "Initial funds credited successfully", transaction });
});

const getTransactionHistory = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE)
  );

  const { status } = req.query;
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ message: "Invalid status filter" });
  }

  const history = await transactionService.getHistory({
    userId: req.user._id,
    page,
    limit,
    status,
  });
  return res.status(200).json(history);
});

module.exports = { createTransaction, createInitialFundsTransaction, getTransactionHistory };
