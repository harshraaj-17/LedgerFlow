const { isValidAmount } = require("./money");

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NAME_MAX_LENGTH = 100;
const PASSWORD_MIN_LENGTH = 8;
// bcrypt only uses the first 72 bytes of a password.
const PASSWORD_MAX_LENGTH = 72;
const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const isObjectId = (value) => typeof value === "string" && OBJECT_ID_PATTERN.test(value);

/*
 * Every validator returns either `{ error: "message" }` or `{ value: {...} }`
 * where `value` contains the trimmed / normalised data that is safe to use.
 */

function validateIdempotencyKey(key) {
  if (!isNonEmptyString(key)) return { error: "A valid idempotencyKey is required" };
  const trimmed = key.trim();
  if (trimmed.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    return { error: `Idempotency key must be ${IDEMPOTENCY_KEY_MAX_LENGTH} characters or fewer` };
  }
  return { value: trimmed };
}

function validateTransfer(body = {}) {
  const { fromAccount, toAccount, amount, idempotencyKey } = body || {};

  if (![fromAccount, toAccount, idempotencyKey].every(isNonEmptyString)) {
    return { error: "fromAccount, toAccount and idempotencyKey are required" };
  }
  if (!isObjectId(fromAccount) || !isObjectId(toAccount)) {
    return { error: "Invalid account ID" };
  }

  // Normalise case so "ABC..." and "abc..." cannot bypass the same-account check.
  const from = fromAccount.toLowerCase();
  const to = toAccount.toLowerCase();
  if (from === to) return { error: "Source and destination accounts must be different" };

  if (!isValidAmount(amount)) {
    return { error: "Amount must be a positive number with at most two decimal places" };
  }

  const key = validateIdempotencyKey(idempotencyKey);
  if (key.error) return key;

  return { value: { fromAccount: from, toAccount: to, amount, idempotencyKey: key.value } };
}

function validateDeposit(body = {}) {
  const { toAccount, amount, idempotencyKey } = body || {};

  if (!isObjectId(toAccount)) return { error: "A valid toAccount is required" };
  if (!isValidAmount(amount)) {
    return { error: "Amount must be a positive number with at most two decimal places" };
  }

  const key = validateIdempotencyKey(idempotencyKey);
  if (key.error) return key;

  return { value: { toAccount: toAccount.toLowerCase(), amount, idempotencyKey: key.value } };
}

function validateRegistration(body = {}) {
  const { name, email, password } = body || {};

  if (!isNonEmptyString(name) || typeof email !== "string" || typeof password !== "string") {
    return { error: "Name, email and password are required" };
  }
  if (name.trim().length > NAME_MAX_LENGTH) {
    return { error: `Name must be ${NAME_MAX_LENGTH} characters or fewer` };
  }
  if (!EMAIL_PATTERN.test(email.trim())) return { error: "A valid email address is required" };
  if (password.length < PASSWORD_MIN_LENGTH || Buffer.byteLength(password) > PASSWORD_MAX_LENGTH) {
    return { error: `Password must contain ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} bytes` };
  }

  return { value: { name: name.trim(), email: email.trim().toLowerCase(), password } };
}

function validateLogin(body = {}) {
  const { email, password } = body || {};
  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Email and password are required" };
  }
  return { value: { email: email.trim().toLowerCase(), password } };
}

module.exports = {
  EMAIL_PATTERN,
  isObjectId,
  validateTransfer,
  validateDeposit,
  validateRegistration,
  validateLogin,
};
