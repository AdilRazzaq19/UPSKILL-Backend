const axios = require('axios');
const Quiz = require("../Models/VideoQuiz");
const Video = require("../Models/Video");

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

const getQuizSet = async (req, res) => {
  try {
    const video_id = req.params.video_id; // YouTube video id (string)
    const attempt = parseInt(req.params.attempt) || 1;

    const quizDoc = await Quiz.findOne({ video_id: video_id });
    if (!quizDoc) {
      return res.status(404).json({ message: "Quiz not found for the given video" });
    }

    const mcqs = quizDoc.mcqs;
    const total = mcqs.length;
    if (total === 0) {
      return res.status(404).json({ message: "No MCQs found in this quiz" });
    }

    const easy = mcqs.filter(q => q.complexity.toLowerCase() === "easy");
    const medium = mcqs.filter(q => q.complexity.toLowerCase() === "medium");
    const hard = mcqs.filter(q => q.complexity.toLowerCase() === "hard");

    const set1 = [
      ...easy.slice(0, 3),
      ...medium.slice(0, 4),
      ...hard.slice(0, 3)
    ];
    const set2 = [
      ...easy.slice(3, 7),
      ...medium.slice(4, 7),
      ...hard.slice(3, 6)
    ];
    const set3 = [
      ...easy.slice(7, 10),     // next 3 easy
      ...medium.slice(7, 10),   // next 3 medium
      ...hard.slice(6, 10)      // next 4 hard
    ];
    const mod = attempt % 3;
    let resultSet;
    if (mod === 1) {
      resultSet = set1;
    } else if (mod === 2) {
      resultSet = set2;
    } else {
      resultSet = set3;
    }

    return res.status(200).json({
      message: "Quiz set retrieved successfully",
      attempt: attempt,
      set: resultSet,
      counts: {
        total,
        easy: easy.length,
        medium: medium.length,
        hard: hard.length,
        set1: set1.length,
        set2: set2.length,
        set3: set3.length
      }
    });
  } catch (error) {
    console.error("Error retrieving quiz set:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};




const evaluateQuizScore = async (req, res) => {
  try {
    const { video_id, userAnswers } = req.body;

    if (!video_id || !userAnswers || !Array.isArray(userAnswers)) {
      return res.status(400).json({ error: "video_id and userAnswers array are required." });
    }

    const videoQuiz = await Quiz.findOne({ video_id });
    if (!videoQuiz) {
      return res.status(404).json({ error: "Quiz not found for the provided video_id." });
    }

    const mcqs = videoQuiz.mcqs;
    if (!mcqs || mcqs.length === 0) {
      return res.status(404).json({ error: "No quiz questions found for the provided video_id." });
    }

    let correctCount = 0;
    mcqs.forEach((question) => {
      const userAnswerObj = userAnswers.find(
        (ans) => ans.question_number === question.question_number
      );
      if (userAnswerObj && userAnswerObj.answer === question.correct_option) {
        correctCount++;
      }
    });

    const totalQuestions = mcqs.length;
    const percentage = totalQuestions ? (correctCount / totalQuestions) * 100 : 0;

    return res.status(200).json({
      video_id,
      score: correctCount,
      total: totalQuestions,
      percentage: percentage.toFixed(2)
    });
  } catch (error) {
    console.error("Error evaluating quiz score:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  storeQuiz,
  getQuizSet,
  evaluateQuizScore,
};

