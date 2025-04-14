const express = require("express");
const router = express.Router();
const { submitFeedback, getAllFeedback } = require("../Controller/FeedbackController");
const {authMiddleware} = require("../middleware/auth.middleware"); 

router.post("/submit", authMiddleware, submitFeedback);
router.get("/getAllFeedback", authMiddleware, getAllFeedback);
module.exports = router;
