// controllers/videoQuickReview.js
const axios              = require("axios");
const Video              = require("../Models/Video");
const QuickReviewStatement   = require("../Models/QuickReviewStatement");

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
