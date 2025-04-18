const express = require("express");
const { storeQuiz } = require("../Controller/QuizController");
const router = express.Router();

router.post("/create/:video_id", storeQuiz);  


module.exports = router;
