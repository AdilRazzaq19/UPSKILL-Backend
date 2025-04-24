// controllers/videoQuickReview.js
const axios              = require("axios");
const Video              = require("../Models/Video");
const QuickReviewStatement   = require("../Models/QuickReviewStatement");
const UserProgress         = require("../Models/userProgress");

exports.storeQuickReview = async (req, res, next) => {
  const video_id = req.params.video_id;

  try {
    const aiRes = await axios.post(
      "http://15.237.7.12/v2/generate_statements/",
      { video_id }
    );

    const raw = aiRes.data?.statements;
    if (!Array.isArray(raw)) {
      return res.status(400).json({ message: "Invalid AI response format" });
    }
    const statements = raw
      .filter(item => !item.statement.startsWith("Here are"))
      .map(item => ({
        statement: item.statement
          .replace(/\*+/g, "")           // remove all asterisks
          .replace(/^\s*\d+\.\s*/, "")   // strip leading "1. ", "2. " etc.
          .trim(),
        is_true: item.is_true,
        explanation: item.explanation
          .replace(/\*+/g, "")
          .replace(/^\s*\d+\.\s*/, "")
          .trim()
      }));

    // 4) Find the Video document
    const video = await Video.findOne({ youtubeVideo_id: video_id });
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    // 5) Upsert the VideoQuickReview doc
    let doc = await QuickReviewStatement.findOne({ video: video._id });
    const isNew = !doc;

    if (doc) {
      doc.statements = statements;
      await doc.save();
    } else {
      doc = await QuickReviewStatement.create({
        video:      video._id,
        statements
      });
    }

    // 6) Optionally link it in video.quickReviews if you track that
    if (Array.isArray(video.quickReviewStatements)) {
      const exists = video.quickReviewStatements.some(id => id.equals(doc._id));
      if (!exists) {
        video.quickReviewStatements.push(doc._id);
        await video.save();
      }
    }

    // 7) Return just the cleaned array
    return res.json(statements);
  }
  catch (err) {
    console.error("Error storing statements:", err);
    return res.status(500).json({
      message: "Failed to store statements",
      error:   err.message
    });
  }
};

exports.getQuickReviewStatements = async (req, res, next) => {
  const video_id = req.params.video_id;
  
  try {
    // Find the Video document by YouTube ID
    const video = await Video.findOne({ youtubeVideo_id: video_id });
    
    if (!video) {
      return res.status(404).json({ 
        message: "Video not found with the provided YouTube ID" 
      });
    }
    
    // Find the QuickReviewStatement document associated with the video
    const quickReview = await QuickReviewStatement.findOne({ video: video._id });
    
    if (!quickReview) {
      return res.status(404).json({ 
        message: "No review statements found for this video" 
      });
    }
    
    // Return the statements array
    return res.json(quickReview.statements);
  } 
  catch (err) {
    console.error("Error retrieving quick review statements:", err);
    return res.status(500).json({
      message: "Failed to retrieve quick review statements",
      error: err.message
    });
  }
};

exports.storeQuickReviewScore = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { score, moduleId } = req.body;

    if (typeof score !== "number") {
      return res.status(400).json({ message: "Invalid score: must be a number." });
    }

    if (!moduleId) {
      return res.status(400).json({ message: "moduleId is required." });
    }

    // 1) Upsert the UserProgress doc
    let progress = await UserProgress.findOne({ user_id: userId });
    if (!progress) {
      progress = await UserProgress.create({
        user_id: userId,
        module_scores: [{
          module_id: moduleId,
          quickreview_score: score,
          quickreview_attempts: 1,
          quickreview_last_attempt_date: new Date(),
          highest_quickreview_score: score,
          quickreview_scores: [{
            score: score,
            date: new Date()
          }]
        }]
      });
    } else {

      // Find or create the module score document
      const moduleScoreIndex = progress.module_scores.findIndex(
        ms => ms.module_id.toString() === moduleId
      );

      if (moduleScoreIndex === -1) {
        // This is the first time scoring this module
        progress.module_scores.push({
          module_id: moduleId,
          quickreview_score: score,
          quickreview_attempts: 1,
          quickreview_last_attempt_date: new Date(),
          highest_quickreview_score: score,
          quickreview_scores: [{
            score: score,
            date: new Date()
          }]
        });
      } else {
        const moduleScore = progress.module_scores[moduleScoreIndex];
        
        moduleScore.quickreview_score = score;
        moduleScore.quickreview_attempts += 1;
        moduleScore.quickreview_last_attempt_date = new Date();
        if (score > moduleScore.highest_quickreview_score) {
          moduleScore.highest_quickreview_score = score;
        }
        moduleScore.quickreview_scores.push({
          score: score,
          date: new Date()
        });
      }
    }
    if (score >= 7) {
      const award = 10;
      progress.points = (progress.points || 0) + award;

      const now = new Date();

      // — daily_points —
      {
        const todayKey = now.toISOString().split("T")[0];
        let day = progress.daily_points.find(d => d.date.toISOString().split("T")[0] === todayKey);
        if (day) {
          day.points += award;
        } else {
          progress.daily_points.push({ date: now, points: award });
        }
      }

      // — weekly_points (Monday–Sunday) —
      {
        const dayOfWeek = now.getDay();         // 0=Sun,1=Mon...
        const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() + diffToMon);
        weekStart.setHours(0,0,0,0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23,59,59,999);

        let wk = progress.weekly_points.find(w =>
          w.weekStart.getTime() === weekStart.getTime() &&
          w.weekEnd.getTime() === weekEnd.getTime()
        );
        if (wk) {
          wk.points += award;
        } else {
          progress.weekly_points.push({ weekStart, weekEnd, points: award });
        }
      }

      // — monthly_points (YYYY-MM) —
      {
        const year  = now.getFullYear();
        const month = String(now.getMonth()+1).padStart(2,"0");
        const key   = `${year}-${month}`;
        let mo = progress.monthly_points.find(m => m.month === key);
        if (mo) {
          mo.points += award;
        } else {
          progress.monthly_points.push({ month: key, points: award });
        }
      }
    }
    await progress.save();

    const moduleScore = progress.module_scores.find(ms => ms.module_id.toString() === moduleId);

    return res.json({
      message: "Quick review score saved",
      moduleQuickReviewScore: moduleScore ? moduleScore.quickreview_score : score,
      moduleQuickReviewAttempts: moduleScore ? moduleScore.quickreview_attempts : 1,
      highestModuleQuickReviewScore: moduleScore ? moduleScore.highest_quickreview_score : score,
      totalPoints: progress.points
    });
  } catch (err) {
    console.error("Error storing quick review score:", err);
    return res.status(500).json({
      message: "Failed to store quick review score",
      error: err.message
    });
  }
};

