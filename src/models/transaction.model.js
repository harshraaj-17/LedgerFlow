const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    // TRANSFER moves money between two accounts; DEPOSIT is a system credit with no source account.
    type: { type: String, enum: ["TRANSFER", "DEPOSIT"], default: "TRANSFER", required: true },
    fromAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "account",
      index: true,
      required: function isSourceRequired() {
        return this.type === "TRANSFER";
      },
    },
    toAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "account",
      required: true,
      index: true,
    },
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED", "REVERSED"],
      default: "PENDING",
      required: true,
    },
    amount: { type: Number, required: true, min: [0.01, "Amount must be positive"] },
    currency: { type: String, enum: ["INR"], default: "INR", required: true },
    idempotencyKey: { type: String, required: true, trim: true, maxlength: 128 },
    requestFingerprint: { type: String, required: true, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.requestFingerprint;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// A client may reuse a key only for retrying the same request; keys are scoped per user.
transactionSchema.index({ initiatedBy: 1, idempotencyKey: 1 }, { unique: true });

module.exports = mongoose.model("transaction", transactionSchema);
