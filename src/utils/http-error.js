/**
 * Error that carries an HTTP status code so services can signal
 * expected failures (validation, ownership, insufficient funds, ...)
 * without touching the Express response object.
 */
class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}

module.exports = HttpError;
