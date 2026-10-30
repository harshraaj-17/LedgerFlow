const REQUIRED_VARIABLES = ["MONGO_URI", "JWT_SECRET"];
const MIN_JWT_SECRET_LENGTH = 32;

/** Fails fast with a readable message when the environment is misconfigured. */
function validateEnv(env = process.env) {
  const missing = REQUIRED_VARIABLES.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  if (env.JWT_SECRET.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters long.`);
  }
}

module.exports = { validateEnv };
