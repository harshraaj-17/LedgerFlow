const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateTransfer,
  validateDeposit,
  validateRegistration,
  validateLogin,
} = require("../src/utils/validators");

const ID_A = "64b7f0c2a1b2c3d4e5f60718";
const ID_B = "64b7f0c2a1b2c3d4e5f60719";

const transfer = (overrides = {}) => ({
  fromAccount: ID_A,
  toAccount: ID_B,
  amount: 125.5,
  idempotencyKey: "key-1",
  ...overrides,
});

test("transfer: accepts a valid payload and normalises it", () => {
  const { error, value } = validateTransfer(
    transfer({ fromAccount: ID_A.toUpperCase(), idempotencyKey: "  key-1  " })
  );
  assert.equal(error, undefined);
  assert.equal(value.fromAccount, ID_A);
  assert.equal(value.idempotencyKey, "key-1");
});

test("transfer: rejects missing fields", () => {
  assert.match(validateTransfer({}).error, /required/);
  assert.match(validateTransfer(undefined).error, /required/);
  assert.match(validateTransfer(null).error, /required/);
});

test("transfer: rejects invalid account IDs", () => {
  assert.match(validateTransfer(transfer({ fromAccount: "bad" })).error, /Invalid account ID/);
  // 12-character strings are accepted by mongoose.isValidObjectId but are not real hex ids.
  assert.match(validateTransfer(transfer({ toAccount: "abcdefghijkl" })).error, /Invalid account ID/);
});

test("transfer: rejects same source and destination, ignoring letter case", () => {
  assert.match(validateTransfer(transfer({ toAccount: ID_A })).error, /different/);
  assert.match(validateTransfer(transfer({ toAccount: ID_A.toUpperCase() })).error, /different/);
});

test("transfer: accepts amounts with up to two decimals, including ones that break naive checks", () => {
  for (const amount of [0.01, 1.1, 0.07, 19.99, 125.5, 1000]) {
    assert.equal(validateTransfer(transfer({ amount })).error, undefined, `amount ${amount}`);
  }
});

test("transfer: rejects non-positive, fractional-cent, non-numeric and huge amounts", () => {
  for (const amount of [0, -1, NaN, Infinity, 1.001, "10", null, undefined, 1e12]) {
    assert.ok(validateTransfer(transfer({ amount })).error, `amount ${String(amount)}`);
  }
});

test("transfer: rejects over-long and blank idempotency keys", () => {
  assert.match(validateTransfer(transfer({ idempotencyKey: "k".repeat(129) })).error, /128/);
  assert.ok(validateTransfer(transfer({ idempotencyKey: "   " })).error);
});

test("deposit: validates account, amount and key", () => {
  assert.equal(validateDeposit({ toAccount: ID_A, amount: 10, idempotencyKey: "d-1" }).error, undefined);
  assert.match(validateDeposit({ toAccount: "x", amount: 10, idempotencyKey: "d-1" }).error, /toAccount/);
  assert.match(validateDeposit({ toAccount: ID_A, amount: 0, idempotencyKey: "d-1" }).error, /Amount/);
  assert.match(validateDeposit({ toAccount: ID_A, amount: 5 }).error, /idempotencyKey/);
});

test("registration: normalises valid input", () => {
  const { error, value } = validateRegistration({
    name: "  Alex ",
    email: " Alex@Example.COM ",
    password: "a-long-password",
  });
  assert.equal(error, undefined);
  assert.deepEqual(value, { name: "Alex", email: "alex@example.com", password: "a-long-password" });
});

test("registration: rejects bad names, emails and passwords", () => {
  const good = { name: "Alex", email: "alex@example.com", password: "a-long-password" };
  assert.ok(validateRegistration({ ...good, name: "   " }).error);
  assert.ok(validateRegistration({ ...good, name: "n".repeat(101) }).error);
  assert.ok(validateRegistration({ ...good, email: "not-an-email" }).error);
  assert.ok(validateRegistration({ ...good, password: "short" }).error);
  assert.ok(validateRegistration({ ...good, password: "p".repeat(73) }).error);
  assert.ok(validateRegistration({ ...good, password: { $gt: "" } }).error);
  assert.ok(validateRegistration(undefined).error);
});

test("login: requires string credentials (blocks NoSQL operator injection)", () => {
  assert.ok(validateLogin({ email: { $ne: null }, password: "x" }).error);
  assert.ok(validateLogin({ email: "a@b.co", password: { $ne: null } }).error);
  assert.equal(validateLogin({ email: " A@B.co ", password: "x" }).value.email, "a@b.co");
});
