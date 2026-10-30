const mongoose = require("mongoose");

const ledgerModel = require("./ledger.model");
const { roundMoney } = require("../utils/money");

const accountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
      immutable: true,
    },
    status: { type: String, enum: ["ACTIVE", "FROZEN", "CLOSED"], default: "ACTIVE", required: true },
    currency: { type: String, enum: ["INR"], default: "INR", required: true },
    // Incremented inside every money-moving transaction so that concurrent
    // transfers on the same account conflict and retry instead of racing.
    ledgerVersion: { type: Number, default: 0, select: false },
  },
  { timestamps: true }
);

accountSchema.index({ user: 1, status: 1 });

/**
 * Balance = SUM(CREDIT entries) - SUM(DEBIT entries).
 * Pass a session to read inside a running MongoDB transaction.
 */
accountSchema.methods.getBalance = async function getBalance(session) {
  const sumByType = (type) => ({
    $sum: { $cond: [{ $eq: ["$type", type] }, "$amount", 0] },
  });

  const [row] = await ledgerModel.aggregate(
    [
      { $match: { account: this._id } },
      { $group: { _id: null, credit: sumByType("CREDIT"), debit: sumByType("DEBIT") } },
    ],
    session ? { session } : {}
  );

  return row ? roundMoney(row.credit - row.debit) : 0;
};

module.exports = mongoose.model("account", accountSchema);
