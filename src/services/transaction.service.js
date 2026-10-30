const crypto = require("node:crypto");
const mongoose = require("mongoose");

const accountModel = require("../models/account.model");
const ledgerModel = require("../models/ledger.model");
const transactionModel = require("../models/transaction.model");
const HttpError = require("../utils/http-error");
const { toMinorUnits } = require("../utils/money");

const TRANSACTION_OPTIONS = {
  readConcern: { level: "snapshot" },
  writeConcern: { w: "majority" },
  readPreference: "primary",
};

/** Hash of the business-relevant request fields, used to detect idempotency-key misuse. */
function createFingerprint(fields) {
  return crypto.createHash("sha256").update(JSON.stringify(fields)).digest("hex");
}

/**
 * Looks for a previous request that used the same idempotency key.
 * Returns the stored transaction for a safe retry, or null when the key is new.
 * Throws 409 when the key was used for a different request.
 */
async function findReplay(userId, idempotencyKey, fingerprint) {
  const existing = await transactionModel
    .findOne({ initiatedBy: userId, idempotencyKey })
    .select("+requestFingerprint");

  if (!existing) return null;
  if (existing.requestFingerprint !== fingerprint) {
    throw new HttpError(409, "Idempotency key was already used with a different request");
  }
  return existing;
}

/** Runs `work(session)` inside a MongoDB transaction (retried on transient errors) and returns its result. */
async function runInTransaction(work) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      result = await work(session);
    }, TRANSACTION_OPTIONS);
    return result;
  } finally {
    await session.endSession();
  }
}

/** Re-reads the winner of a concurrent request that hit the unique idempotency index. */
async function resolveDuplicateKey(userId, idempotencyKey, fingerprint) {
  const replay = await findReplay(userId, idempotencyKey, fingerprint);
  if (!replay) throw new HttpError(409, "A request with this idempotency key already exists");
  return { transaction: replay, replayed: true };
}

/**
 * Moves money from one of the user's accounts to any active account.
 * @returns {Promise<{ transaction: object, replayed: boolean }>}
 */
async function transferFunds({ user, fromAccount, toAccount, amount, idempotencyKey }) {
  const fingerprint = createFingerprint({ type: "TRANSFER", fromAccount, toAccount, amount });

  const replay = await findReplay(user._id, idempotencyKey, fingerprint);
  if (replay) return { transaction: replay, replayed: true };

  try {
    const transaction = await runInTransaction(async (session) => {
      // Bumping ledgerVersion "touches" both accounts, so two concurrent transfers on the
      // same account conflict and one is retried, instead of both trusting a stale balance.
      // Operations inside one transaction must run sequentially, not in parallel.
      const from = await accountModel.findOneAndUpdate(
        { _id: fromAccount, user: user._id, status: "ACTIVE" },
        { $inc: { ledgerVersion: 1 } },
        { new: true, session }
      );
      if (!from) throw new HttpError(403, "Source account not found, not owned by you, or inactive");

      const to = await accountModel.findOneAndUpdate(
        { _id: toAccount, status: "ACTIVE" },
        { $inc: { ledgerVersion: 1 } },
        { new: true, session }
      );
      if (!to) throw new HttpError(404, "Destination account not found or inactive");

      if (from.currency !== to.currency) {
        throw new HttpError(400, "Source and destination currencies must match");
      }

      const balance = await from.getBalance(session);
      if (toMinorUnits(balance) < toMinorUnits(amount)) {
        throw new HttpError(422, "Insufficient funds");
      }

      const [created] = await transactionModel.create(
        [
          {
            type: "TRANSFER",
            fromAccount: from._id,
            toAccount: to._id,
            initiatedBy: user._id,
            amount,
            currency: from.currency,
            idempotencyKey,
            requestFingerprint: fingerprint,
            status: "COMPLETED",
          },
        ],
        { session }
      );

      await ledgerModel.create(
        [
          { account: from._id, transaction: created._id, type: "DEBIT", amount },
          { account: to._id, transaction: created._id, type: "CREDIT", amount },
        ],
        { session, ordered: true }
      );

      return created;
    });

    return { transaction, replayed: false };
  } catch (error) {
    if (error.code === 11000) return resolveDuplicateKey(user._id, idempotencyKey, fingerprint);
    throw error;
  }
}

/**
 * System operation: credits an account with new money (no source account).
 * @returns {Promise<{ transaction: object, replayed: boolean }>}
 */
async function creditInitialFunds({ systemUser, toAccount, amount, idempotencyKey }) {
  const fingerprint = createFingerprint({ type: "DEPOSIT", toAccount, amount });

  const replay = await findReplay(systemUser._id, idempotencyKey, fingerprint);
  if (replay) return { transaction: replay, replayed: true };

  try {
    const transaction = await runInTransaction(async (session) => {
      const to = await accountModel.findOneAndUpdate(
        { _id: toAccount, status: "ACTIVE" },
        { $inc: { ledgerVersion: 1 } },
        { new: true, session }
      );
      if (!to) throw new HttpError(404, "Destination account not found or inactive");

      const [created] = await transactionModel.create(
        [
          {
            type: "DEPOSIT",
            toAccount: to._id,
            initiatedBy: systemUser._id,
            amount,
            currency: to.currency,
            idempotencyKey,
            requestFingerprint: fingerprint,
            status: "COMPLETED",
          },
        ],
        { session }
      );

      await ledgerModel.create(
        [{ account: to._id, transaction: created._id, type: "CREDIT", amount }],
        { session }
      );

      return created;
    });

    return { transaction, replayed: false };
  } catch (error) {
    if (error.code === 11000) return resolveDuplicateKey(systemUser._id, idempotencyKey, fingerprint);
    throw error;
  }
}

/** Paginated history of every transaction that touches one of the user's accounts. */
async function getHistory({ userId, page, limit, status }) {
  const accountIds = await accountModel.find({ user: userId }).distinct("_id");
  const filter = { $or: [{ fromAccount: { $in: accountIds } }, { toAccount: { $in: accountIds } }] };
  if (status) filter.status = status;

  const [transactions, total] = await Promise.all([
    transactionModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    transactionModel.countDocuments(filter),
  ]);

  return { transactions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

module.exports = { transferFunds, creditInitialFunds, getHistory };
