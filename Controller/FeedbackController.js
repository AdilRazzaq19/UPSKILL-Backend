const Feedback = require("../Models/Userfeedback");
const Module = require("../Models/Module");
const User = require("../Models/User");
const UserProgress = require("../Models/userProgress");
const Badge = require("../Models/Badge"); 

const awardBadgeOnce = async (progress, badgeName, targetPointsField) => {
  const allocatedBadgeIds = progress.badges.map(b => b.toString());
  const badge = await Badge.findOne({ name: badgeName });
  if (badge && !allocatedBadgeIds.includes(badge._id.toString())) {
    progress.badges.push(badge._id);
    if (targetPointsField && progress[targetPointsField] !== undefined) {
      progress[targetPointsField] += badge.points;
    }
    progress.points += badge.points;
  }
};

const submitFeedback = async (req, res) => {
  try {
    const { module_id, rating, feedback_text } = req.body;
    const user_id = req.user._id;

    if (!module_id || !rating) {
      return res.status(400).json({
        message: "Module ID and rating are required.",
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        message: "Rating must be between 1 and 5.",
      });
    }

    const moduleExists = await Module.findById(module_id);
    if (!moduleExists) {
      return res.status(404).json({ message: "Module not found." });
    }

    const userExists = await User.findById(user_id);
    if (!userExists) {
      return res.status(404).json({ message: "User not found." });
    }

    const newFeedback = new Feedback({
      user_id,
      module_id,
      rating,
      feedback_text,
      date_of_feedback: new Date(),
    });
    await newFeedback.save();

    let userProgress = await UserProgress.findOne({ user_id });
    if (!userProgress) {
      userProgress = new UserProgress({ user_id, points: 0, badges: [] });
    }
    await awardBadgeOnce(userProgress, "Rating the module");

    if (feedback_text && feedback_text.trim().length > 0) {
      await awardBadgeOnce(userProgress, "Leaving a short comment");
      if (/suggest/i.test(feedback_text)) {
        await awardBadgeOnce(userProgress, "Suggesting an improvement");
      }
      if (/issue|error|problem/i.test(feedback_text)) {
        await awardBadgeOnce(userProgress, "Reporting an issue");
      }
    }

    await userProgress.save();
    userProgress = await UserProgress.findById(userProgress._id)
    .populate("badges")
    .populate("learnedSkills");
    return res.status(201).json({
      message: "Feedback submitted successfully. Points awarded and badges updated.",
      feedback: newFeedback,
      userProgress,
    });
  } catch (error) {
    console.error("Error submitting feedback:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

module.exports = { submitFeedback };
