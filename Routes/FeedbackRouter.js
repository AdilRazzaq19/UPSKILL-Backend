const express = require("express");
const router = express.Router();
const { submitFeedback } = require("../Controller/FeedbackController");
const {authMiddleware} = require("../middleware/auth.middleware"); 

router.post("/submit", authMiddleware, submitFeedback);

module.exports = router;
