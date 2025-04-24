const express = require("express");
const { storeQuiz,  storeQuizScore} = require("../Controller/QuizController");
const router = express.Router();
const {authMiddleware}= require("../middleware/auth.middleware");

router.post("/create/:video_id", storeQuiz);  
router.post("/updateScore", authMiddleware, storeQuizScore)

module.exports = router;
