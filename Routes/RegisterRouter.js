const express = require("express");
const { RegisterAdmin, RegisterUser } = require("../Controller/RegisterController");

const router = express.Router();

router.post("/admin", RegisterAdmin);
router.post("/user", RegisterUser);

module.exports = router;
