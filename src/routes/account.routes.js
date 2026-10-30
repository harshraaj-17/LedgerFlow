const express = require("express");
const { authMiddleware } = require("../middleware/auth.middleware");
const controller = require("../controllers/account.controller");

const router = express.Router();

router.post("/", authMiddleware, controller.createAccountController);
router.get("/", authMiddleware, controller.getUserAccountsController);
router.get("/balance/:accountId", authMiddleware, controller.getAccountBalanceController);

module.exports = router;
