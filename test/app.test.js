const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = "test-secret-that-is-at-least-32-characters-long";

const app = require("../src/app");

// These tests exercise routing, auth and error handling only; no database is needed
// because every request below is rejected before a query is made.
let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

const request = (path, options = {}) =>
  fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });

test("GET /health reports ok", async () => {
  const response = await request("/health");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("unknown routes return a JSON 404", async () => {
  const response = await request("/nope");
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { message: "Route not found" });
});

test("protected routes require a token", async () => {
  for (const path of ["/api/accounts", "/api/transactions"]) {
    const response = await request(path);
    assert.equal(response.status, 401, path);
  }
});

test("protected routes reject a malformed token", async () => {
  const response = await request("/api/accounts", { headers: { Authorization: "Bearer not-a-jwt" } });
  assert.equal(response.status, 401);
});

test("malformed JSON returns 400", async () => {
  const response = await request("/api/auth/login", { method: "POST", body: "{bad json" });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { message: "Invalid JSON body" });
});

test("login validates the request body before touching the database", async () => {
  const response = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: { $ne: null }, password: "x" }),
  });
  assert.equal(response.status, 400);
});

test("oversized bodies are rejected with 413", async () => {
  const response = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "a@b.co", password: "x".repeat(30_000) }),
  });
  assert.equal(response.status, 413);
});
