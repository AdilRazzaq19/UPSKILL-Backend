const Feedback = require("../Models/Userfeedback");
const Module = require("../Models/Module");
const User = require("../Models/User");
const UserProgress = require("../Models/userProgress");
const Badge = require("../Models/Badge");

// Updated awardBadgeOnce with an extra parameter to allow duplicate awarding
const awardBadgeOnce = async (progress, badgeName, targetPointsField, allowDuplicate = false) => {
  if (!progress.badges) {
    progress.badges = [];
  }
  if (!allowDuplicate) {
    // Normal behavior: check for duplicates
    const allocatedBadgeIds = progress.badges
      .filter(b => b && b.badge)
      .map(b => b.badge.toString());
      
    const badge = await Badge.findOne({ name: badgeName });
    if (badge && !allocatedBadgeIds.includes(badge._id.toString())) {
      progress.badges.push({ badge: badge._id, awarded_at: new Date() });
      if (targetPointsField && progress[targetPointsField] !== undefined) {
        progress[targetPointsField] += badge.points;
      }
      progress.points += badge.points;
    }
  } else {
    // For feedback submissions, always award a new instance (allow duplicate)
    const badge = await Badge.findOne({ name: badgeName });
    if (badge) {
      progress.badges.push({ badge: badge._id, awarded_at: new Date() });
      if (targetPointsField && progress[targetPointsField] !== undefined) {
        progress[targetPointsField] += badge.points;
      }
      progress.points += badge.points;
    }
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
    
    // Check if feedback exists for this module by this user
    let feedbackRecord = await Feedback.findOne({ user_id, module_id });
    if (feedbackRecord) {
      // Update existing feedback record
      feedbackRecord.rating = rating;
      feedbackRecord.feedback_text = feedback_text;
      feedbackRecord.date_of_feedback = new Date();
      await feedbackRecord.save();
    } else {
      // Create new feedback record
      feedbackRecord = new Feedback({
        user_id,
        module_id,
        rating,
        feedback_text,
        date_of_feedback: new Date(),
      });
      await feedbackRecord.save();
    }
    
    let userProgress = await UserProgress.findOne({ user_id });
    if (!userProgress) {
      userProgress = new UserProgress({ user_id, points: 0, badges: [] });
    }
    
    // Store current points so we can calculate the difference after awarding feedback badges.
    const pointsBefore = userProgress.points;
    
    // Award feedback badges (allow duplicates so that each submission adds new points)
    await awardBadgeOnce(userProgress, "Rating the module", null, true);
    if (feedback_text && feedback_text.trim().length > 0) {
      await awardBadgeOnce(userProgress, "Leaving a short comment", null, true);
      if (/suggest/i.test(feedback_text)) {
        await awardBadgeOnce(userProgress, "Suggesting an improvement", null, true);
      }
      if (/issue|error|problem/i.test(feedback_text)) {
        await awardBadgeOnce(userProgress, "Reporting an issue", null, true);
      }
    }
    
    // Calculate points earned in this feedback submission.
    const pointsEarned = userProgress.points - pointsBefore;
    
    // Update daily points
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    let dailyEntry = userProgress.daily_points.find(entry => {
      const entryDate = new Date(entry.date);
      return entryDate.getTime() === currentDate.getTime();
    });
    if (dailyEntry) {
      dailyEntry.points += pointsEarned;
    } else {
      userProgress.daily_points.push({ date: currentDate, points: pointsEarned });
    }
    
    // Update weekly points
    const day = currentDate.getDay();
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - day + (day === 0 ? -6 : 1));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    let weeklyEntry = userProgress.weekly_points.find(entry =>
      new Date(entry.weekStart).toISOString().split('T')[0] === startOfWeek.toISOString().split('T')[0]
    );
    if (weeklyEntry) {
      weeklyEntry.points += pointsEarned;
    } else {
      userProgress.weekly_points.push({
        weekStart: startOfWeek,
        weekEnd: endOfWeek,
        points: pointsEarned
      });
    }
    
    // Update monthly points
    const monthLabel = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    let monthlyEntry = userProgress.monthly_points.find(entry => entry.month === monthLabel);
    if (monthlyEntry) {
      monthlyEntry.points += pointsEarned;
    } else {
      userProgress.monthly_points.push({
        month: monthLabel,
        points: pointsEarned
      });
    }
    
    await userProgress.save();
    
    // Populate nested badge field and learnedSkills
    userProgress = await UserProgress.findById(userProgress._id)
      .populate({
        path: "badges.badge",
        select: "name description type tagline points criteria hidden"
      })
      .populate("learnedSkills");
    
    // Filter and flatten badges to include only feedback-related ones.
    const feedbackBadgeNames = [
      "Rating the module",
      "Leaving a short comment",
      "Suggesting an improvement",
      "Reporting an issue"
    ];
    const flattenedFeedbackBadges = userProgress.badges
      .filter(b => b.badge && feedbackBadgeNames.includes(b.badge.name))
      .map(b => ({
        _id: b.badge._id,
        name: b.badge.name,
        type: b.badge.type,
        description: b.badge.description,
        tagline: b.badge.tagline,
        points: b.badge.points,
        criteria: b.badge.criteria,
        hidden: b.badge.hidden,
        awarded_at: b.awarded_at
      }));
    
    const responseProgress = {
      ...userProgress.toObject(),
      badges: flattenedFeedbackBadges,
      total_badge_points: flattenedFeedbackBadges.reduce((acc, badge) => acc + (badge.points || 0), 0),
      daily_points: userProgress.daily_points,
      weekly_points: userProgress.weekly_points,
      monthly_points: userProgress.monthly_points
    };
    
    return res.status(201).json({
      message: "Feedback submitted successfully. Points awarded and badges updated.",
      feedback: feedbackRecord,
      userProgress: responseProgress
    });
  } catch (error) {
    console.error("Error submitting feedback:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

module.exports = { submitFeedback };
