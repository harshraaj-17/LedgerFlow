const test = require("node:test");
const assert = require("node:assert/strict");

const { isValidAmount, toMinorUnits, roundMoney } = require("../src/utils/money");

test("toMinorUnits converts to integer paise without drift", () => {
  assert.equal(toMinorUnits(1.1), 110);
  assert.equal(toMinorUnits(0.07), 7);
  assert.equal(toMinorUnits(19.99), 1999);
});

test("roundMoney removes floating point noise from sums", () => {
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
  assert.equal(roundMoney(110.00000000000001), 110);
});

test("isValidAmount rejects values outside the supported range", () => {
  assert.equal(isValidAmount(0.009), false);
  assert.equal(isValidAmount(1_000_000_001), false);
  assert.equal(isValidAmount(1_000_000_000), true);
});
