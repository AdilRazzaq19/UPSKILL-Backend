const axios = require('axios');
const Quiz = require("../Models/VideoQuiz");
const Video = require("../Models/Video");
const UserProgress= require("../Models/userProgress");

const storeQuiz = async (req, res) => {
  const video_id = req.params.video_id;
  
  try {
    // Fetch MCQs from external API
    const response = await axios.get("http://15.237.7.12/v2/mcqs/", {
      params: { video_id }
    });
    
    // Parse and validate MCQ data
    let mcqArray = [];
    if (Array.isArray(response.data)) {
      mcqArray = response.data;
    } else if (response.data && Array.isArray(response.data.mcqs)) {
      mcqArray = response.data.mcqs;
    } else {
      return res.status(400).json({ message: "Invalid MCQ data format from external API" });
    }
    
    // Transform MCQs to ensure all required fields
    const transformedMCQs = mcqArray.map(mcq => {
      // 1) Normalize correct_option (always “option_a” | “option_b” | “option_c” | “option_d”)
      const rawCorrect = (mcq.correct_option || "")
        .toString()
        .toLowerCase()
        .trim();
    
      let correct_option = "";
      if (["a","b","c","d"].includes(rawCorrect)) {
        correct_option = `option_${rawCorrect}`;           // e.g. “option_b”
      } else if (/^option_[abcd]$/i.test(mcq.correct_option || "")) {
        // if they sent “OPTION_C” or “Option_C”, this will catch it
        correct_option = rawCorrect;                       // already lower‑cased above
      } else {
        console.warn(`Unexpected correct_option "${mcq.correct_option}"`);
        correct_option = "";                               // or pick a sensible default
      }
    
      // 2) Normalize complexity (always “easy” | “medium” | “hard”)
      const rawComplexity = (mcq.complexity || "")
        .toString()
        .toLowerCase()
        .trim();
    
      const complexity = ["easy","medium","hard"].includes(rawComplexity)
        ? rawComplexity
        : (console.warn(`Unexpected complexity "${mcq.complexity}"`), "medium");
    
      return {
        video_id:         mcq.video_id         || video_id,
        transcription_id: mcq.transcription_id || "",
        question_number:  mcq.question_number  || "",
        question:         mcq.question          || "",
        option_a:         mcq.option_a          || "",
        option_b:         mcq.option_b          || "",
        option_c:         mcq.option_c          || "",
        option_d:         mcq.option_d          || "",
        correct_option,   // guaranteed lowercase “option_x”
        explanation:      mcq.explanation       || "",
        complexity        // guaranteed lowercase “easy”/“medium”/“hard”
      };
    });
    
    
    // Find the video
    const video = await Video.findOne({ youtubeVideo_id: video_id });
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }
    
    // Handle quiz document - first find an existing quiz
    let quizDoc = await Quiz.findOne({ video_id: video_id });
    let isNewQuiz = false;
    
    if (quizDoc) {
      quizDoc.mcqs = transformedMCQs;
      await quizDoc.save();
    } else {
      isNewQuiz = true;
      quizDoc = new Quiz({
        video_id: video_id,
        mcqs: transformedMCQs
      });
      await quizDoc.save();
    }
    
    if (video.quizzes && video.quizzes.length > 0) {
      const existingQuizzes = await Quiz.find({
        _id: { $in: video.quizzes, $ne: quizDoc._id }
      });
            const quizzesWithVideoId = existingQuizzes
        .filter(quiz => quiz.video_id === video_id)
        .map(quiz => quiz._id);
      
      if (quizzesWithVideoId.length > 0) {
        video.quizzes = video.quizzes.filter(
          qId => !quizzesWithVideoId.some(id => id.toString() === qId.toString())
        );
        await Quiz.updateMany(
          { _id: { $in: quizzesWithVideoId } },
          { $set: { isObsolete: true } }
        );
      }
    }
    
    if (!video.quizzes.some(id => id.toString() === quizDoc._id.toString())) {
      video.quizzes.push(quizDoc._id);
    }
    
    await video.save();
    
    res.status(200).json({
      message: isNewQuiz 
        ? "New MCQs stored successfully and linked to video" 
        : "Existing MCQs updated successfully",
      quiz: quizDoc,
      count: transformedMCQs.length
    });
  } catch (error) {
    console.error("Error storing MCQs:", error);
    res.status(500).json({
      message: "Failed to store MCQs",
      error: error.message
    });
  }
};

const storeQuizScore = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { score, moduleId } = req.body;

    if (typeof score !== "number") {
      return res.status(400).json({ message: "Invalid score: must be a number." });
    }

    if (!moduleId) {
      return res.status(400).json({ message: "moduleId is required." });
    }

    let progress = await UserProgress.findOne({ user_id: userId });
    if (!progress) {
      progress = await UserProgress.create({
        user_id: userId,
        module_scores: [{
          module_id: moduleId,
          quiz_score: score,
          quiz_attempts: 1,
          quiz_last_attempt_date: new Date(),
          highest_quiz_score: score,
          quiz_scores: [{
            score: score,
            date: new Date(),
          }]
        }]
      });
    } else {
      const moduleScoreIndex = progress.module_scores.findIndex(
        ms => ms.module_id.toString() === moduleId
      );

      if (moduleScoreIndex === -1) {
        progress.module_scores.push({
          module_id: moduleId,
          quiz_score: score,
          quiz_attempts: 1,
          quiz_last_attempt_date: new Date(),
          highest_quiz_score: score,
          quiz_scores: [{
            score: score,
            date: new Date(),
          }]
        });
      } else {
        const moduleScore = progress.module_scores[moduleScoreIndex];
        moduleScore.quiz_score = score;
        moduleScore.quiz_attempts += 1;
        moduleScore.quiz_last_attempt_date = new Date();
        if (score > moduleScore.highest_quiz_score) {
          moduleScore.highest_quiz_score = score;
        }
        moduleScore.quiz_scores.push({
          score: score,
          date: new Date(),
        });
      }
    }
    await progress.save();

    const moduleScore = progress.module_scores.find(ms => ms.module_id.toString() === moduleId);

    return res.json({
      message: "Quiz score saved successfully",
      moduleQuizScore: moduleScore.quiz_score,
      moduleQuizAttempts: moduleScore.quiz_attempts,
      highestModuleQuizScore: moduleScore.highest_quiz_score,
      quizHistory: moduleScore.quiz_scores
    });
  } catch (err) {
    console.error("Error storing quiz score:", err);
    return res.status(500).json({
      message: "Failed to store quiz score",
      error: err.message
    });
  }
};
module.exports = {
  storeQuiz,
  storeQuizScore
};

