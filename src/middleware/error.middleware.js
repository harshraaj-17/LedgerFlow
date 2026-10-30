const HttpError = require("../utils/http-error");

function notFoundHandler(req, res) {
  return res.status(404).json({ message: "Route not found" });
}

// Express identifies error handlers by their four-argument signature.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON body" });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body is too large" });
  }
  if (err?.name === "ValidationError") {
    const errors = Object.values(err.errors || {}).map((e) => e.message);
    return res.status(400).json({ message: "Validation failed", errors });
  }
  if (err?.name === "CastError") {
    return res.status(400).json({ message: "Invalid identifier" });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ message: "A record with a unique field already exists" });
  }

  console.error("Unhandled request error:", err?.message || "Unknown error");
  return res.status(500).json({ message: "Internal server error" });
}

module.exports = { notFoundHandler, errorHandler };
