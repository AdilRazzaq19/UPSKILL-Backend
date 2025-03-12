const express = require("express");
const { evaluateQuizScore, storeQuiz,getQuizSet } = require("../Controller/QuizController");
const router = express.Router();

router.post("/create/:video_id", storeQuiz);  
router.post("/evaluate", evaluateQuizScore);
router.get("/attempt/:video_id/:attempt", getQuizSet);

module.exports = router;
