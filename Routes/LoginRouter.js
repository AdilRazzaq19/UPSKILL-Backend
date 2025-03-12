const express = require("express");
const { loginAdmin, loginUser } = require("../Controller/LoginController");

const router = express.Router();

router.post("/admin", loginAdmin);
router.post("/user", loginUser);

module.exports = router;
