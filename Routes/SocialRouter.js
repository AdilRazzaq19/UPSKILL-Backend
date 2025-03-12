const express = require("express");
const { socialLogin } = require("../Controller/SocialLoginController");
const router = express.Router();

router.post("/social", socialLogin);

module.exports = router;
