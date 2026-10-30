const mongoose = require("mongoose");

const tokenBlacklistSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    // MongoDB's TTL monitor removes the document once the token has expired anyway.
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

module.exports = mongoose.model("tokenBlacklist", tokenBlacklistSchema);
