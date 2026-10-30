const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const { EMAIL_PATTERN } = require("../utils/validators");

const BCRYPT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: 254,
      match: EMAIL_PATTERN,
    },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    password: { type: String, required: true, minlength: 8, select: false },
    // Can only be set by a trusted administrative process (e.g. a DB script).
    systemUser: { type: Boolean, default: false, immutable: true, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.password;
        delete ret.systemUser;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.pre("save", async function hashPassword() {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS);
  }
});

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("user", userSchema);
