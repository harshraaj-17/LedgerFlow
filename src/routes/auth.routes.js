const express = require("express");
const controller = require("../controllers/auth.controller");

const router = express.Router();

router.post("/register", controller.userRegisterController);
router.post("/login", controller.userLoginController);
router.post("/logout", controller.userLogoutController);

module.exports = router;
