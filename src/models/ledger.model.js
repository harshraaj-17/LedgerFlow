const mongoose = require("mongoose");

const ledgerSchema = new mongoose.Schema(
  {
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "account",
      required: true,
      index: true,
      immutable: true,
    },
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "transaction",
      required: true,
      index: true,
      immutable: true,
    },
    type: { type: String, enum: ["CREDIT", "DEBIT"], required: true, immutable: true },
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Ledger amount must be positive"],
      immutable: true,
    },
  },
  { timestamps: true }
);

// Ledger entries are append-only: corrections must be made with a reversal transaction.
const BLOCKED_OPERATIONS = [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "replaceOne",
  "findOneAndReplace",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
];

function preventMutation() {
  throw new Error("Ledger entries are append-only; create a reversal transaction instead.");
}

for (const operation of BLOCKED_OPERATIONS) {
  ledgerSchema.pre(operation, preventMutation);
}

module.exports = mongoose.model("ledger", ledgerSchema);
