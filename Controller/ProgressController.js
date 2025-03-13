const mongoose = require("mongoose");
const User = require("../Models/User");
const Module = require("../Models/Module");
const Section = require("../Models/Section");
const Theme = require("../Models/Theme");
const Badge = require("../Models/Badge");
const UserProgress = require('../Models/userProgress'); 
const UserLearning=require("../Models/Learning")
const Video=require("../Models/Video")
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
const updateStreaks = async (progress) => {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  // Ensure streak counters are initialized.
  progress.dailyStreak = progress.dailyStreak || 0;
  progress.maxDailyStreak = progress.maxDailyStreak || 0;
  progress.weeklyStreak = progress.weeklyStreak || 0;
  progress.maxWeeklyStreak = progress.maxWeeklyStreak || 0;
  progress.consecutiveModules = progress.consecutiveModules || 0;

  // If there's no record of a previous completion, initialize everything.
  if (!progress.lastCompletionDate) {
    progress.dailyStreak = 1;
    progress.consecutiveModules = 1;
    progress.lastCompletionDate = now;
  } else {
    const lastDateStr = new Date(progress.lastCompletionDate).toISOString().split("T")[0];

    // If a module has already been completed today, don't update streaks further.
    if (lastDateStr === todayStr) {
      return;
    }

    // Compute yesterday's date string.
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    if (lastDateStr === yesterdayStr) {
      // Last module was completed yesterday, so we continue the streak.
      progress.dailyStreak += 1;
      progress.consecutiveModules += 1;
    } else {
      // Otherwise, the streak is broken and we start over.
      progress.dailyStreak = 1;
      progress.consecutiveModules = 1;
    }
    // Record today's completion.
    progress.lastCompletionDate = now;
  }

  // Update the maximum daily streak if needed.
  if (progress.dailyStreak > progress.maxDailyStreak) {
    progress.maxDailyStreak = progress.dailyStreak;
  }

  // Every 5-day daily streak increases the weekly streak and awards a badge.
  if (progress.dailyStreak % 5 === 0 && progress.dailyStreak !== 0) {
    progress.weeklyStreak += 1;
    if (progress.weeklyStreak > progress.maxWeeklyStreak) {
      progress.maxWeeklyStreak = progress.weeklyStreak;
    }
    await awardBadgeOnce(progress, "Daily Devotee");
  }
  if (progress.dailyStreak === 30) {
    await awardBadgeOnce(progress, "Weekly Warrior");
  }
  if (progress.consecutiveModules === 3) {
    await awardBadgeOnce(progress, "Triple Triumph");
  } else if (progress.consecutiveModules === 5) {
    await awardBadgeOnce(progress, "Pentagon Pursuer");
  } else if (progress.consecutiveModules === 10) {
    await awardBadgeOnce(progress, "Decathlon Achiever");
  }
};


  const allocateModuleThresholdBadges = async (progress) => {
  const allocatedBadgeIds = progress.badges.map(b => b.toString());
  const moduleCount = progress.completed_modules.length;
  const moduleThresholds = [
    { count: 1, name: "Bronze" },
    { count: 3, name: "Silver" },
    { count: 5, name: "Gold" },
    { count: 10, name: "Platinum" },
  ];

  for (const threshold of moduleThresholds) {
    if (moduleCount >= threshold.count) {
      const badge = await Badge.findOne({ name: threshold.name });
      if (badge && !allocatedBadgeIds.includes(badge._id.toString())) {
        progress.badges.push(badge._id);
        progress.module_points += badge.points;
        progress.points += badge.points;
      }
    }
  }
};

const allocateMasterBadge = async (progress, quizScore) => {
  if (quizScore === 10) {
    await awardBadgeOnce(progress, "Master of Accuracy");
  }
};

const allocateModuleMilestoneBadges = async (progress) => {
  const countCompletedModules = progress.completed_modules.length;

  if (countCompletedModules === 5) {
    await awardBadgeOnce(progress, "Ai Padawan");
  } else if (countCompletedModules === 20) {
    await awardBadgeOnce(progress, "Next-Level AI Nerd");
  } else if (countCompletedModules === 50) {
    await awardBadgeOnce(progress, "AI Rockstar");
  } else if (countCompletedModules === 100) {
    await awardBadgeOnce(progress, "Ai Guru");
  } else if (countCompletedModules === 150) {
    await awardBadgeOnce(progress, "AI Legend");
  }
};
const completeModule = async (req, res) => {
  try {
    const userId = req.user._id;
    const { module_id, quizScore } = req.body;
  
    if (typeof quizScore !== "number" || quizScore < 8) {
      return res.status(400).json({ message: "Quiz score too low to mark module as completed." });
    }
  
    const moduleDoc = await Module.findById(module_id).populate("section_id");
    if (!moduleDoc) {
      return res.status(404).json({ message: "Module not found" });
    }
  
    const sectionId = moduleDoc.section_id._id;
    const themeId = moduleDoc.section_id.theme_id;
  
    const user = await User.findById(userId).populate({
      path: "userProgress",
      populate: { path: "badges", select: "name description type tagline points criteria hidden" },
    });
    if (!user || !user.userProgress) {
      return res.status(500).json({ message: "User progress document not found." });
    }
  
    let userLearning = await UserLearning.findOne({ user_id: userId, section_id: sectionId });
    if (!userLearning) {
      return res.status(404).json({ message: "User learning record not found." });
    }
  
    const progress = user.userProgress;
    progress.completed_modules = progress.completed_modules || [];
    progress.section_progress = progress.section_progress || [];
    progress.theme_progress = progress.theme_progress || [];
    progress.badges = progress.badges || [];
    progress.module_points = progress.module_points || 0;
    progress.section_points = progress.section_points || 0;
    progress.theme_points = progress.theme_points || 0;
    progress.points = progress.points || 0;
    progress.daily_points = progress.daily_points || [];
    progress.weekly_points = progress.weekly_points || [];
    progress.monthly_points = progress.monthly_points || [];
  
    const pointsBefore = progress.points;
  
    if (progress.completed_modules.some(m => m.module_id.toString() === module_id)) {
      return res.status(400).json({ message: "Module already completed" });
    }
  
    const moduleBadge = await Badge.findOne({ name: "Completing Module" });
    let modulePointsEarned = 0;
    if (moduleBadge) {
      modulePointsEarned = moduleBadge.points;
      progress.module_points += moduleBadge.points;
      progress.points += moduleBadge.points;
      progress.badges.push(moduleBadge._id);
    }
    progress.completed_modules.push({ module_id, completed_at: new Date(), points_earned: modulePointsEarned });
  
    userLearning.modules.forEach(module => {
      if (module.module_id.toString() === module_id) {
        module.completed = true;
        module.video_progress = 100;
      }
    });
  
    await updateStreaks(progress);
    await allocateModuleThresholdBadges(progress);
  
    const modulesInSection = await Module.find({ section_id: sectionId }, "_id");
    const completedInSectionCount = progress.completed_modules.filter(m =>
      modulesInSection.some(mod => mod._id.toString() === m.module_id.toString())
    ).length;
    const sectionCompletionPercentage = Math.round((completedInSectionCount / modulesInSection.length) * 100);
  
    let sectionProgress = progress.section_progress.find(sp =>
      sp.section_id.toString() === sectionId.toString()
    );
    let sectionJustCompleted = false;
    if (!sectionProgress) {
      sectionProgress = {
        section_id: sectionId,
        status: completedInSectionCount === modulesInSection.length ? "completed" : "in_progress",
        completion_percentage: sectionCompletionPercentage,
        started_at: new Date(),
      };
      if (completedInSectionCount === modulesInSection.length) {
        sectionProgress.completed_at = new Date();
        sectionJustCompleted = true;
      }
      progress.section_progress.push(sectionProgress);
    } else {
      sectionProgress.status = completedInSectionCount === modulesInSection.length ? "completed" : "in_progress";
      sectionProgress.completion_percentage = sectionCompletionPercentage;
      if (completedInSectionCount === modulesInSection.length && !sectionProgress.completed_at) {
        sectionProgress.completed_at = new Date();
        sectionJustCompleted = true;
      }
    }
  
    // If section is fully completed, award section badges.
    if (sectionJustCompleted) {
      const sectionBadges = await Badge.find({ type: "Section Completion" });
      sectionBadges.forEach(sectionBadge => {
        progress.section_points += sectionBadge.points;
        progress.points += sectionBadge.points;
        progress.badges.push(sectionBadge._id);
      });
    }
  
    let themeJustCompleted = false;
    if (themeId) {
      const sectionsInTheme = await Section.find({ theme_id: themeId }, "_id");
      const totalSections = sectionsInTheme.length;
      const completedSectionsCount = progress.section_progress.filter(sp =>
        sectionsInTheme.some(sec => sec._id.toString() === sp.section_id.toString() && sp.status === "completed")
      ).length;
      const themeCompletionPercentage = Math.round((completedSectionsCount / totalSections) * 100);
  
      let themeProgress = progress.theme_progress.find(tp =>
        tp.theme_id.toString() === themeId.toString()
      );
      if (!themeProgress) {
        themeProgress = {
          theme_id: themeId,
          status: completedSectionsCount === totalSections ? "completed" : "in_progress",
          completion_percentage: themeCompletionPercentage,
          started_at: new Date(),
        };
        if (completedSectionsCount === totalSections) {
          themeProgress.completed_at = new Date();
          themeJustCompleted = true;
        }
        progress.theme_progress.push(themeProgress);
      } else {
        themeProgress.status = completedSectionsCount === totalSections ? "completed" : "in_progress";
        themeProgress.completion_percentage = themeCompletionPercentage;
        if (completedSectionsCount === totalSections && !themeProgress.completed_at) {
          themeProgress.completed_at = new Date();
          themeJustCompleted = true;
        }
      }
      if (themeJustCompleted) {
        const themeBadges = await Badge.find({ type: "Theme Completion" });
        themeBadges.forEach(themeBadge => {
          progress.theme_points += themeBadge.points;
          progress.points += themeBadge.points;
          progress.badges.push(themeBadge._id);
        });
      }
    }
  
    await allocateMasterBadge(progress, quizScore);
    await allocateModuleMilestoneBadges(progress);
  
    const pointsEarned = progress.points - pointsBefore;
  
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
  
    const dayStr = currentDate.toISOString().split("T")[0];
    let dailyEntry = progress.daily_points.find(entry => {
      return new Date(entry.date).toISOString().split("T")[0] === dayStr;
    });
    if (dailyEntry) {
      dailyEntry.points += pointsEarned;
    } else {
      progress.daily_points.push({ date: currentDate, points: pointsEarned });
    }
  
    const day = currentDate.getDay();
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - day + (day === 0 ? -6 : 1));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
  
    let weeklyEntry = progress.weekly_points.find(entry => {
      return new Date(entry.weekStart).toISOString().split("T")[0] === startOfWeek.toISOString().split("T")[0];
    });
    if (weeklyEntry) {
      weeklyEntry.points += pointsEarned;
    } else {
      progress.weekly_points.push({ weekStart: startOfWeek, weekEnd: endOfWeek, points: pointsEarned });
    }
  
    const monthLabel = `${currentDate.getFullYear()}-${('0' + (currentDate.getMonth() + 1)).slice(-2)}`;
    let monthlyEntry = progress.monthly_points.find(entry => entry.month === monthLabel);
    if (monthlyEntry) {
      monthlyEntry.points += pointsEarned;
    } else {
      progress.monthly_points.push({ month: monthLabel, points: pointsEarned });
    }  

      const videosInModule = await Video.find({ module_id: module_id }, "learnedSkills");
      let moduleLearnedSkills = [];
      videosInModule.forEach(video => {
        if (video.learnedSkills && video.learnedSkills.length > 0) {
          moduleLearnedSkills = moduleLearnedSkills.concat(video.learnedSkills);
        }
      });
      if (!progress.learnedSkills) {
        progress.learnedSkills = [];
      }
      progress.learnedSkills = progress.learnedSkills.concat(moduleLearnedSkills);
      await progress.save();
      await userLearning.save();
  
    const fullBadges = await Badge.find(
      { _id: { $in: progress.badges } },
      "name description type tagline points criteria hidden"
    );
    const countCompletedModules = progress.completed_modules.length;
    const countCompletedSections = progress.section_progress.filter(sp => sp.status === "completed").length;
    const countCompletedThemes = progress.theme_progress.filter(tp => tp.status === "completed").length;
  
    res.status(200).json({
      message: "Module completed",
      progress: {
        completed_modules: progress.completed_modules,
        total_modules_completed: countCompletedModules,
        module_points: progress.module_points,
        section_progress: progress.section_progress,
        total_sections_completed: countCompletedSections,
        section_points: progress.section_points,
        theme_progress: progress.theme_progress,
        total_themes_completed: countCompletedThemes,
        theme_points: progress.theme_points,
        total_points: progress.points,
        daily_points: progress.daily_points,
        weekly_points: progress.weekly_points,
        monthly_points: progress.monthly_points,
        total_badge_points: progress.total_badge_points,
        badges: fullBadges,
        dailyStreak: progress.dailyStreak,
        maxDailyStreak: progress.maxDailyStreak,
        weeklyStreak: progress.weeklyStreak,
        maxWeeklyStreak: progress.maxWeeklyStreak,
        consecutiveModules: progress.consecutiveModules,
        learnedSkills: progress.learnedSkills  
      },
    });
  } catch (error) {
    console.error("Error completing module:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};






  
  const getUserProgress = async (req, res) => {
    try {
      const userId = req.user._id;
  
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "Invalid user id provided." });
      }
  
      const progress = await UserProgress.findOne({ user_id: userId })
        .populate({
          path: "badges",
          select: "name type description tagline points criteria hidden",
        }).populate({
          path:"learnedSkills"
        });
  
      if (!progress) {
        return res.status(404).json({ message: "User progress not found." });
      }
  
  
      res.status(200).json({
        progress: {
          ...progress.toObject(),
        },
      });
    } catch (error) {
      console.error("Error fetching user progress:", error);
      res.status(500).json({ message: error.message });
    }
  };
  
  
  

const getModuleProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).populate("userProgress");
    if (!user || !user.userProgress) {
      return res.status(500).json({ message: "User progress document not found." });
    }
    const progress = user.userProgress;
    res.status(200).json({
      completed_modules: progress.completed_modules,
      total_modules_completed: progress.completed_modules.length,
      module_points: progress.module_points || 0,
      dailyStreak: progress.dailyStreak,
      weeklyStreak: progress.weeklyStreak,
    });
  } catch (error) {
    console.error("Error fetching module progress:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getSectionProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).populate("userProgress");
    if (!user || !user.userProgress) {
      return res.status(500).json({ message: "User progress document not found." });
    }
    const progress = user.userProgress;
    const completedSectionsCount = progress.section_progress.filter(sp => sp.status === "completed").length;
    res.status(200).json({
      section_progress: progress.section_progress,
      total_sections_completed: completedSectionsCount,
      section_points: progress.section_points || 0,
    });
  } catch (error) {
    console.error("Error fetching section progress:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getThemeProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).populate("userProgress");
    if (!user || !user.userProgress) {
      return res.status(500).json({ message: "User progress document not found." });
    }
    const progress = user.userProgress;
    const completedThemesCount = progress.theme_progress.filter(tp => tp.status === "completed").length;
    res.status(200).json({
      theme_progress: progress.theme_progress,
      total_themes_completed: completedThemesCount,
      theme_points: progress.theme_points || 0,
    });
  } catch (error) {
    console.error("Error fetching theme progress:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getUserWeeklyTotalPoints = async (req, res) => {
  try {
    const userId = req.user._id;
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID provided." });
    }
        const progress = await UserProgress.findOne({ user_id: userId });
    if (!progress) {
      return res.status(404).json({ message: "User progress not found." });
    }
    const weeklyPointsArray = progress.weekly_points || [];
    const sortedWeeklyPoints = weeklyPointsArray.sort((a, b) => new Date(a.weekStart) - new Date(b.weekStart));
    
    const graphData = sortedWeeklyPoints.map(entry => {
      const weekStart = new Date(entry.weekStart);
      const weekEnd = new Date(entry.weekEnd);
      const weekStartLabel = `${weekStart.toISOString().split("T")[0]} (${weekStart.toLocaleDateString('en-US', { weekday: 'long' })})`;
      const weekEndLabel = `${weekEnd.toISOString().split("T")[0]} (${weekEnd.toLocaleDateString('en-US', { weekday: 'long' })})`;
      const weekKey = `${weekStartLabel} - ${weekEndLabel}`;
      return {
        week: weekKey,
        points: entry.points
      };
    });
    
    res.status(200).json({ graphData });
  } catch (error) {
    console.error("Error retrieving user weekly points:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};



const getUserDailyPointsHeat = async (req, res) => {
  try {
    const userId = req.user._id;
    
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID provided." });
    }
        const progress = await UserProgress.findOne({ user_id: userId });
    if (!progress) {
      return res.status(404).json({ message: "User progress not found." });
    }
    
    const heatData = (progress.daily_points || [])
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(entry => ({
        date: entry.date.toISOString().split("T")[0],  
        points: entry.points
      }));
    
    res.status(200).json({ heatData });
  } catch (error) {
    console.error("Error retrieving daily points heat data:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


const userRanking = async (req, res) => {
  try {
    const progressList = await UserProgress.find({})
      .populate('user_id', 'username')
      .sort({ points: -1 });
      
    const totalUsers = progressList.length;

    let rankedList = [];
    let lastPoints = null;
    let lastOrdinalRank = 0;
    let lastPercentile = 0;

    for (let i = 0; i < totalUsers; i++) {
      const current = progressList[i];
      let ordinalRank, percentile;

      if (i === 0) {
        ordinalRank = 1;
        percentile = Math.ceil(((i + 1) / totalUsers) * 100);
      } else {
        if (current.points === lastPoints) {
          ordinalRank = lastOrdinalRank;
          percentile = lastPercentile;
        } else {
          ordinalRank = i + 1;
          percentile = Math.ceil(((i + 1) / totalUsers) * 100);
        }
      }

      rankedList.push({
        user_id: current.user_id._id,
        username: current.user_id.username,
        points: current.points,
        rank: ordinalRank,
        percentileRank: percentile
      });

      lastPoints = current.points;
      lastOrdinalRank = ordinalRank;
      lastPercentile = percentile;
    }

    res.status(200).json({
      message: 'User percentile rankings retrieved successfully',
      data: rankedList
    });
  } catch (error) {
    console.error('Error retrieving percentile rankings:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

const userIndividualRanking = async (req, res) => {
  try {
    const user_id = req.user._id;
    
    if (!user_id) {
      return res.status(400).json({ message: "User id is required." });
    }
    
    const progressList = await UserProgress.find({})
      .populate('user_id', 'username')
      .sort({ points: -1 });
      
    const totalUsers = progressList.length;
    
    let rankedList = [];
    let lastPoints = null;
    let lastOrdinalRank = 0;
    let lastPercentile = 0;
        for (let i = 0; i < totalUsers; i++) {
      const current = progressList[i];
      let ordinalRank, percentile;
  
      if (i === 0) {
        ordinalRank = 1;
        percentile = Math.ceil(((i + 1) / totalUsers) * 100);
      } else {
        if (current.points === lastPoints) {
          ordinalRank = lastOrdinalRank;
          percentile = lastPercentile;
        } else {
          ordinalRank = i + 1;
          percentile = Math.ceil(((i + 1) / totalUsers) * 100);
        }
      }
  
      rankedList.push({
        user_id: current.user_id._id,
        username: current.user_id.username,
        points: current.points,
        rank: ordinalRank,
        percentileRank: percentile
      });
  
      lastPoints = current.points;
      lastOrdinalRank = ordinalRank;
      lastPercentile = percentile;
    }
        const userRankData = rankedList.find(
      (item) => item.user_id.toString() === user_id.toString()
    );
    
    if (!userRankData) {
      return res.status(404).json({ message: "User not found in rankings." });
    }
    
    res.status(200).json({
      message: "User percentile ranking retrieved successfully",
      data: userRankData
    });
    
  } catch (error) {
    console.error("Error retrieving percentile rankings:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};



module.exports = {
  completeModule,
  getModuleProgress,
  getSectionProgress,
  getThemeProgress,
  getUserProgress,
  getUserWeeklyTotalPoints,
  getUserDailyPointsHeat,
  userRanking,
  userIndividualRanking,
};
