const express = require("express");
const { authMiddleware, authSystemUserMiddleware } = require("../middleware/auth.middleware");
const controller = require("../controllers/transaction.controller");

const router = express.Router();

router.post("/", authMiddleware, controller.createTransaction);
router.get("/", authMiddleware, controller.getTransactionHistory);
router.post(
  "/system/initial-funds",
  authSystemUserMiddleware,
  controller.createInitialFundsTransaction
);

module.exports = router;
