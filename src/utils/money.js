const MAX_AMOUNT = 1_000_000_000;

/**
 * An amount is valid when it is a finite number between 0.01 and MAX_AMOUNT
 * with at most two decimal places.
 *
 * Note: `Math.round(x * 100) !== x * 100` is NOT a safe check, because
 * floating point makes values such as 1.1 * 100 equal 110.00000000000001.
 */
function isValidAmount(amount) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return false;
  if (amount < 0.01 || amount > MAX_AMOUNT) return false;
  const cents = amount * 100;
  return Math.abs(cents - Math.round(cents)) < 1e-6;
}

/** Converts a currency amount to an integer number of minor units (paise/cents). */
function toMinorUnits(amount) {
  return Math.round(amount * 100);
}

/** Rounds to two decimal places to remove floating point noise from sums. */
function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

module.exports = { MAX_AMOUNT, isValidAmount, toMinorUnits, roundMoney };
