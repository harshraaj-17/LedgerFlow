const accountModel = require("../models/account.model");
const asyncHandler = require("../middleware/async-handler");
const { isObjectId } = require("../utils/validators");

const createAccountController = asyncHandler(async (req, res) => {
  const account = await accountModel.create({ user: req.user._id });
  return res.status(201).json({ account });
});

const getUserAccountsController = asyncHandler(async (req, res) => {
  const accounts = await accountModel.find({ user: req.user._id }).sort({ createdAt: -1 });
  return res.status(200).json({ accounts });
});

const getAccountBalanceController = asyncHandler(async (req, res) => {
  const { accountId } = req.params;
  if (!isObjectId(accountId)) return res.status(400).json({ message: "Invalid account ID" });

  // Scoping the query by owner means other users' accounts look like "not found".
  const account = await accountModel.findOne({ _id: accountId, user: req.user._id });
  if (!account) return res.status(404).json({ message: "Account not found" });

  return res.status(200).json({
    accountId: account._id,
    currency: account.currency,
    balance: await account.getBalance(),
  });
});

module.exports = { createAccountController, getUserAccountsController, getAccountBalanceController };
