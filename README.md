# LedgerFlow — Banking Transaction Management API

A learning/portfolio backend for ledger-based account balances and account-to-account transfers, built with Node.js, Express, MongoDB, and Mongoose. It includes JWT authentication, user-owned accounts, append-only ledger entries, idempotency keys, MongoDB transactions, and optional email notifications.

> **Disclaimer:** This is an educational portfolio project, not production banking software. It has not undergone an independent security audit. Do not use it to hold or transfer real money.

## Features

- User registration and login with bcrypt password hashing.
- JWT authentication via Bearer token or HTTP-only cookie; token revocation on logout.
- Account creation and account-owner-only balance queries.
- Ledger-derived balances (credits minus debits).
- Account-to-account transfers using MongoDB transactions.
- Request idempotency scoped to the initiating user and payload fingerprint checks.
- System-user-protected initial-funds operation.
- Paginated transaction history for accounts owned by the authenticated user.
- Optional Gmail OAuth2 notifications.
- Centralized Express error handling and environment configuration.

## Tech stack

Node.js, Express 5, MongoDB, Mongoose, JSON Web Tokens, bcryptjs, cookie-parser, Nodemailer.

## Requirements

- Node.js LTS and npm.
- MongoDB deployment supporting transactions (a replica set or MongoDB Atlas).

## Setup

```bash
git clone https://github.com/harshraaj-17/banking-transaction-system.git
cd banking-transaction-system
npm install
```

Copy `.env.example` to `.env` and set `MONGO_URI` and a random `JWT_SECRET` of at least 32 characters (the example file shows a one-line command to generate one). Email variables are optional; without them, email notifications are skipped.

MongoDB transactions need a replica set. For local development either use a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster, or run a single-node replica set with Docker:

```bash
docker run -d --name ledger-mongo -p 27017:27017 mongo:7 --replSet rs0 --bind_ip_all
docker exec ledger-mongo mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
```

```bash
npm run dev
# or
npm start
```

The default port is `3000`. Check `GET /` or `GET /health`.

## Project structure

```text
server.js                  Entry point: env validation, DB connection, graceful shutdown
src/
  app.js                   Express app (middleware, routes, error handling)
  config/                  Environment validation and DB connection
  controllers/             Thin HTTP layer: validate input, call services, shape responses
  services/                Business logic (transfers, initial funds, history) and email
  models/                  Mongoose schemas (user, account, transaction, ledger, token blacklist)
  middleware/              Authentication, async handler, error handling
  routes/                  Route definitions
  utils/                   Validators, money helpers, HttpError
test/                      Unit and HTTP tests (node:test)
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | HTTP port; defaults to 3000 |
| `NODE_ENV` | No | Set to `production` for secure cookies |
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Random secret, at least 32 characters |
| `JWT_EXPIRES_IN` | No | JWT lifetime; defaults to `3d` |
| `EMAIL_USER` | No | Gmail sender address |
| `CLIENT_ID` | No | Google OAuth client ID |
| `CLIENT_SECRET` | No | Google OAuth client secret |
| `REFRESH_TOKEN` | No | Google OAuth refresh token |

Never commit `.env` or real credentials.

## API

Base URL: `http://localhost:3000`

Authentication: provide `Authorization: Bearer <token>` or use the `token` cookie returned at login/registration.

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `GET` | `/` | No | Service greeting |
| `GET` | `/health` | No | Basic liveness check |
| `POST` | `/api/auth/register` | No | Register user (`name`, `email`, `password`) |
| `POST` | `/api/auth/login` | No | Login (`email`, `password`) |
| `POST` | `/api/auth/logout` | No | Revoke supplied token and clear cookie |
| `POST` | `/api/accounts` | User | Create an account |
| `GET` | `/api/accounts` | User | List own accounts |
| `GET` | `/api/accounts/balance/:accountId` | Owner | Read own account balance |
| `POST` | `/api/transactions` | User | Transfer funds |
| `GET` | `/api/transactions?page=1&limit=20` | User | Transaction history for own accounts |
| `POST` | `/api/transactions/system/initial-funds` | System user | Credit initial funds |

### Register

```json
{ "name": "Alex", "email": "alex@example.com", "password": "a-long-password" }
```

### Create a transfer

```json
{
  "fromAccount": "SOURCE_ACCOUNT_OBJECT_ID",
  "toAccount": "DESTINATION_ACCOUNT_OBJECT_ID",
  "amount": 125.50,
  "idempotencyKey": "unique-client-generated-key-001"
}
```

Amounts must be between 0.01 and 1,000,000,000 and have at most two decimal places. Repeating a request with the same `idempotencyKey` and the same body returns the original transaction with status `200`; reusing the key with a different body returns `409`. Source account must belong to the authenticated user, both accounts must be active, and currencies must match. Reuse the same idempotency key only for retrying the same request.

### Quick walkthrough

```bash
# 1. Register (returns a token and sets a cookie)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alex","email":"alex@example.com","password":"a-long-password"}'

# 2. Create an account
curl -X POST http://localhost:3000/api/accounts -H "Authorization: Bearer $TOKEN"

# 3. Check its balance
curl http://localhost:3000/api/accounts/balance/$ACCOUNT_ID -H "Authorization: Bearer $TOKEN"
```

New accounts start with a zero balance. Funds enter the system only through the system-user initial-funds endpoint described below.

### Initial funds endpoint

This route requires a user whose `systemUser` flag was provisioned by a trusted administrative process. There is deliberately no public API for granting system privileges. The initial-funds operation creates a `DEPOSIT` transaction (no source account) and records a single credit ledger entry; configure and audit such funding logic carefully before any deployment.

## Ledger model

For each account, the balance is calculated as:

`Balance = SUM(CREDIT entries) - SUM(DEBIT entries)`

Ledger entries are intended to be append-only. A completed normal transfer writes a debit and credit entry in the same MongoDB transaction. A production-grade ledger would need additional controls for reversals, reconciliation, concurrency, auditing, and financial precision.

## Security notes and limitations

- Configure production secrets using a secret manager or deployment environment.
- Set appropriate CORS, rate limiting, cookie/CSRF policy, TLS, and monitoring before deployment.
- MongoDB transactions require a transaction-capable deployment.
- This project uses JavaScript numbers for amounts; production financial systems should use integer minor units or a decimal representation consistently.
- Add rate limiting (for example `express-rate-limit`), security headers (`helmet`) and CORS configuration before exposing the API publicly.
- A production system needs deeper concurrency and idempotency testing, audit logs, reconciliation, operational monitoring, and a formal threat model.
- Do not expose the system-user credential or initial-funds endpoint to untrusted users.

## Tests

```bash
npm test
```

The suite covers input validation, money handling, routing, authentication rejection and error handling, and needs no database. Transfer behaviour (transactions, idempotency, concurrency) is not covered yet; add integration tests against a disposable replica-set MongoDB before treating it as verified. GitHub Actions runs the tests on every push.

## License

ISC (see `package.json`).
