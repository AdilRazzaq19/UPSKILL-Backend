const mongoose = require("mongoose");
const User = require("../Models/User");
const Module = require("../Models/Module");
const Section = require("../Models/Section");
const Theme = require("../Models/Theme");
const Badge = require("../Models/Badge");
const UserProgress = require('../Models/userProgress'); 
const UserLearning=require("../Models/Learning")
const Video=require("../Models/Video")
const Skill=require("../Models/Skill")
const Onboarding = require("../Models/Onboarding");


// Modified awardBadgeOnce to return points if a badge was awarded.
// const awardBadgeOnce = async (progress, badgeName, targetPointsField) => {
//   const allocatedBadgeIds = progress.badges.map(b => b.toString());
//   const badge = await Badge.findOne({ name: badgeName });
//   if (badge && !allocatedBadgeIds.includes(badge._id.toString())) {
//     progress.badges.push(badge._id);
//     if (targetPointsField && progress[targetPointsField] !== undefined) {
//       progress[targetPointsField] += badge.points;
//     }
//     progress.points += badge.points;
//     console.log(`Awarded badge "${badgeName}" for ${badge.points} points.`);
//     return badge.points;
//   }
//   return 0;
// };

const awardBadgeOnce = async (progress, badgeName, targetPointsField) => {
  // Ensure progress.badges is defined; if not, initialize it.
  if (!progress.badges) {
    progress.badges = [];
  }

  // Find the badge in the database
  const badge = await Badge.findOne({ name: badgeName });
  if (!badge) {
    console.log(`Badge "${badgeName}" not found in database.`);
    return 0;
  }

  // Check if this badge has already been awarded by checking badge names
  // This is more robust than checking IDs since a badge might have different IDs but same name
  const badgeAlreadyAwarded = progress.badges.some(b => {
    if (b.badge) {
      // If badge is a populated object with a name field
      if (typeof b.badge === 'object' && b.badge.name) {
        return b.badge.name === badgeName;
      }
      // If badge is a reference that needs to be converted to string for comparison
      else {
        return b.badge.toString() === badge._id.toString();
      }
    }
    // If badge is a direct ID reference
    return b.toString() === badge._id.toString();
  });

  // If badge already awarded, return 0 points
  if (badgeAlreadyAwarded) {
    console.log(`Badge "${badgeName}" already awarded, skipping.`);
    return 0;
  }

  // Award the badge with timestamp
  progress.badges.push({ badge: badge._id, awarded_at: new Date() });
  
  // Add points to the specific target field if provided
  if (targetPointsField && progress[targetPointsField] !== undefined) {
    progress[targetPointsField] += badge.points;
  }
  
  // Add points to total
  progress.points += badge.points;
  
  console.log(`Awarded badge "${badgeName}" for ${badge.points} points on ${new Date()}.`);
  return badge.points;
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
  } else {
    const lastDateStr = new Date(progress.lastCompletionDate).toISOString().split("T")[0];
    if (lastDateStr !== todayStr) {
      // Check if the last completion was exactly yesterday.
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      if (lastDateStr === yesterdayStr) {
        progress.dailyStreak += 1;
      } else {
        progress.dailyStreak = 1;
      }
    }
  }
  progress.consecutiveModules += 1;
  progress.lastCompletionDate = now;


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


const awardSkillBadges = async (progress, newSkillIds = []) => {
  // Ensure progress.skill_points and breakdown exist
  if (typeof progress.skill_points !== 'number') {
    progress.skill_points = 0;
  }
  if (!progress.skill_points_breakdown || typeof progress.skill_points_breakdown !== 'object') {
    progress.skill_points_breakdown = {};
  }

  // ------------------------------------------
  // 1. Award Base Points for New Occurrences
  // ------------------------------------------
  // newSkillIds is expected to include duplicates if the same skill is earned multiple times.
  const moduleSkillIds = newSkillIds.map(id => id.toString());
  // Fetch full skill documents for these IDs (we need skill_Name)
  const newFullSkills = await Skill.find({ _id: { $in: moduleSkillIds } });
  const newSkillMap = {};
  newFullSkills.forEach(skill => {
    newSkillMap[skill._id.toString()] = skill;
  });
  // Build counts for this module (new occurrences)
  const moduleSkillCounts = {};
  for (const skillId of moduleSkillIds) {
    const skill = newSkillMap[skillId];
    if (skill && skill.skill_Name) {
      moduleSkillCounts[skill.skill_Name] = (moduleSkillCounts[skill.skill_Name] || 0) + 1;
    }
  }
  
  // Make a copy of the current breakdown
  const updatedBreakdown = { ...progress.skill_points_breakdown };

  // For each skill in this module, add base points (10 per occurrence)
  for (const [skillName, count] of Object.entries(moduleSkillCounts)) {
    updatedBreakdown[skillName] = (updatedBreakdown[skillName] || 0) + (count * 10);
    console.log(`Added ${count * 10} base points for skill: ${skillName}. New total: ${updatedBreakdown[skillName]}`);
  }

  // ------------------------------------------
  // 2. Compute Cumulative Skill Counts (INCLUDING duplicates)
  // ------------------------------------------
  // progress.learnedSkills should contain duplicates.
  const learnedSkillIds = progress.learnedSkills.map(id => id.toString());
  // We use Promise.all with Skill.findById to get every document—even if an ID appears multiple times.
  const allSkillDocs = await Promise.all(learnedSkillIds.map(id => Skill.findById(id)));
  const cumulativeCounts = {};
  allSkillDocs.forEach(doc => {
    if (doc && doc.skill_Name) {
      cumulativeCounts[doc.skill_Name] = (cumulativeCounts[doc.skill_Name] || 0) + 1;
    }
  });
  console.log("Cumulative counts:", cumulativeCounts);
  
  // ------------------------------------------
  // 3. Award Higher Tier Badges When a Threshold Is Crossed
  // ------------------------------------------
  // Define badge tiers (e.g., Silver: threshold 3, Gold: threshold 5, Platinum: threshold 10)
  const badgeTiers = [
    { name: "Silver", threshold: 3, points: 20 },
    { name: "Gold", threshold: 5, points: 30 },
    { name: "Platinum", threshold: 10, points: 50 }
  ];

  // For each skill in the current module, compute:
  //   previousCount = cumulative count BEFORE adding this module's occurrences
  //   currentCumCount = cumulative count AFTER adding them.
  for (const skillName of Object.keys(moduleSkillCounts)) {
    const newCount = moduleSkillCounts[skillName]; // Occurrences in this module
    const currentCumCount = cumulativeCounts[skillName] || newCount; // Total occurrences now
    const previousCount = currentCumCount - newCount; // Occurrences before this module
    console.log(`For skill "${skillName}": previous cumulative count: ${previousCount}, current cumulative count: ${currentCumCount}`);
    
    // For each tier, if the threshold is crossed in this iteration, award the badge.
    for (const tier of badgeTiers) {
      if (previousCount < tier.threshold && currentCumCount >= tier.threshold) {
        const badgeName = `${skillName} ${tier.name}`;
        const pointsAwarded = await awardBadgeOnce(progress, badgeName, 'skill_points');
        if (pointsAwarded > 0) {
          updatedBreakdown[skillName] += pointsAwarded;
          console.log(`Awarded badge ${badgeName}: +${pointsAwarded} points. New total for ${skillName}: ${updatedBreakdown[skillName]}`);
        } else {
          console.log(`Badge ${badgeName} already awarded, no new points.`);
        }
      }
    }
  }

  // ------------------------------------------
  // 4. Ensure Bronze Badge Is Awarded for Each Skill in Module
  // ------------------------------------------
  for (const skillName of Object.keys(moduleSkillCounts)) {
    const badgeName = `${skillName} Bronze`;
    await awardBadgeOnce(progress, badgeName, null);
  }

  // ------------------------------------------
  // 5. Update and Save the Breakdown and Total Skill Points
  // ------------------------------------------
  progress.skill_points_breakdown = updatedBreakdown;
  progress.markModified('skill_points_breakdown');
  progress.skill_points = Object.values(updatedBreakdown)
    .reduce((total, pts) => total + (typeof pts === 'number' ? pts : 0), 0);

  console.log("Updated skill points breakdown:", progress.skill_points_breakdown);
  console.log("Total skill points:", progress.skill_points);
};









const completeModule = async (req, res) => {
  try {
    const userId = req.user._id;
    const { module_id, quizScore } = req.body;
  
    if (typeof quizScore !== "number" || quizScore < 7) {
      return res.status(400).json({ message: "Quiz score too low to mark module as completed." });
    }
  
    const moduleDoc = await Module.findById(module_id).populate("section_id");
    if (!moduleDoc) {
      return res.status(404).json({ message: "Module not found" });
    }
    if (!moduleDoc.section_id) {
      return res.status(404).json({ message: "Section not found for this module" });
    }
  
    const sectionId = moduleDoc.section_id._id;
    const themeId = moduleDoc.section_id.theme_id; 
  
    const user = await User.findById(userId).populate({
      path: "userProgress",
      populate: { path: "badges.badge", select: "name description type tagline points criteria hidden" },
    });
    if (!user || !user.userProgress) {
      return res.status(500).json({ message: "User progress document not found." });
    }
  
    const progress = user.userProgress;
    // Initialize progress fields if needed.
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
  
    // Award the "Completing Module" badge.
    const moduleBadge = await Badge.findOne({ name: "Completing Module" });
    let modulePointsEarned = 0;
    if (moduleBadge) {
      modulePointsEarned = moduleBadge.points;
      progress.module_points += moduleBadge.points;
      progress.points += moduleBadge.points;
      progress.badges.push({ badge: moduleBadge._id, awarded_at: new Date() });
      console.log(`Awarded badge "Completing Module" for ${moduleBadge.points} points.`);
    }
    progress.completed_modules.push({ module_id, completed_at: new Date(), points_earned: modulePointsEarned });
  
    // --- Update the UserLearning document (consolidated schema) ---
    // Find the consolidated UserLearning document for the user.
    let userLearning = await UserLearning.findOne({ user_id: userId });
    if (!userLearning) {
      return res.status(404).json({ message: "User learning record not found." });
    }
    
    // Keep track if we found and updated the module
    let moduleUpdated = false;
    
    console.log("Attempting to mark module as completed:", module_id);
    
    // First check in aiRecommendations
    if (userLearning.aiRecommendations && Array.isArray(userLearning.aiRecommendations)) {
      for (const section of userLearning.aiRecommendations) {
        if (section.modules && Array.isArray(section.modules)) {
          for (const mod of section.modules) {
            if (mod.id && mod.id.toString() === module_id) {
              mod.completed = true;
              moduleUpdated = true;
              console.log(`Module marked completed in aiRecommendations section: ${section.name}`);
            }
          }
        }
      }
      userLearning.markModified("aiRecommendations");
    }
    
    // Check in userPreferenceModules
    if (!moduleUpdated && userLearning.userPreferenceModules && Array.isArray(userLearning.userPreferenceModules)) {
      for (const section of userLearning.userPreferenceModules) {
        if (section.modules && Array.isArray(section.modules)) {
          for (const mod of section.modules) {
            if (mod.id && mod.id.toString() === module_id) {
              mod.completed = true;
              moduleUpdated = true;
              console.log(`Module marked completed in userPreferenceModules section: ${section.name}`);
            }
          }
        }
      }
      userLearning.markModified("userPreferenceModules");
    }
    
    // Legacy structure: Check in sections if still not found
    if (!moduleUpdated && userLearning.sections && Array.isArray(userLearning.sections)) {
      for (const section of userLearning.sections) {
        if (section.modules && Array.isArray(section.modules)) {
          for (const mod of section.modules) {
            if ((mod.module_id && mod.module_id.toString() === module_id) || (mod.id && mod.id.toString() === module_id)) {
              mod.completed = true;
              if (typeof mod.video_progress !== 'undefined') {
                mod.video_progress = 100;
              }
              moduleUpdated = true;
              console.log(`Module marked completed in legacy section.modules structure`);
            }
          }
        }
        if (section.ai_recommendation && Array.isArray(section.ai_recommendation)) {
          for (const mod of section.ai_recommendation) {
            if ((mod.module_id && mod.module_id.toString() === module_id) || (mod.id && mod.id.toString() === module_id)) {
              mod.completed = true;
              if (typeof mod.video_progress !== 'undefined') {
                mod.video_progress = 100;
              }
              moduleUpdated = true;
              console.log(`Module marked completed in legacy section.ai_recommendation structure`);
            }
          }
        }
      }
      userLearning.markModified("sections");
    }
    
    if (!moduleUpdated) {
      console.log(`Warning: Module ${module_id} not found in any section of UserLearning document.`);
      console.log("UserLearning structure summary:");
      if (userLearning.aiRecommendations) console.log(`- aiRecommendations: ${userLearning.aiRecommendations.length} sections`);
      if (userLearning.userPreferenceModules) console.log(`- userPreferenceModules: ${userLearning.userPreferenceModules.length} sections`);
      if (userLearning.sections) console.log(`- sections: ${userLearning.sections.length} sections`);
    } else {
      console.log(`Successfully marked module ${module_id} as completed`);
    }
  
    // Update streaks and other progress metrics.
    await updateStreaks(progress);
  
    // Calculate section completion percentage.
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
  
    if (sectionJustCompleted) {
      const sectionBadges = await Badge.find({ type: "Section Completion" });
      sectionBadges.forEach(sectionBadge => {
        progress.section_points += sectionBadge.points;
        progress.points += sectionBadge.points;
        progress.badges.push({ badge: sectionBadge._id, awarded_at: new Date() });
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
          progress.badges.push({ badge: themeBadge._id, awarded_at: new Date() });
        });
      }
    }
  
    await allocateMasterBadge(progress, quizScore);
    await allocateModuleMilestoneBadges(progress);
  
    // Fetch videos in the module and extract learned skills
    const videosInModulePopulated = await Video.find({ module_id: module_id }).populate({
      path: "learnedSkills",
      select: "uniqueSkill_id skill_theme skill_Name skill_description"
    });
    console.log("Videos in module:", videosInModulePopulated);
    // Extract skills from module videos (allow duplicates so the count accumulates)
    const moduleLearnedSkills = [];
    videosInModulePopulated.forEach(video => {
      if (video.learnedSkills && video.learnedSkills.length > 0) {
        video.learnedSkills.forEach(skill => {
          const skillId = skill._id ? skill._id : skill;
          // Use skill.occurrences if available, default to 1 occurrence otherwise.
          const occurrences = skill.occurrences || 1;
          for (let i = 0; i < occurrences; i++) {
            moduleLearnedSkills.push(skillId);
          }
        });
      }
    });

    // Ensure learnedSkills array exists
    if (!progress.learnedSkills) {
      progress.learnedSkills = [];
    }

    // Accumulate all learned skills from this module (do not filter out duplicates)
    progress.learnedSkills.push(...moduleLearnedSkills);
    console.log("Accumulated learned skills after module:", progress.learnedSkills);


  
    // Award skill badges using the new occurrences from this module
    await awardSkillBadges(progress, moduleLearnedSkills);
    
    // ========== ADDED CODE FOR FIXING SKILL POINTS BREAKDOWN ==========
    console.log("Before saving - Skill points breakdown:", progress.skill_points_breakdown);
    if (!progress.skill_points_breakdown) {
      progress.skill_points_breakdown = {};
    }
    const breakdownCopy = JSON.parse(JSON.stringify(progress.skill_points_breakdown));
    progress.skill_points_breakdown = breakdownCopy;
    progress.markModified('skill_points_breakdown');
    // ===============================================================
  
    const pointsEarned = progress.points - pointsBefore;
  
    // Update daily/weekly/monthly points tracking
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
  
    // Save progress document
    await progress.save();
    await userLearning.save();
    
    // ========== ADDED CODE: REFRESH FROM DATABASE ==========
    const updatedProgress = await UserProgress.findById(progress._id);
    const responseSkillPointsBreakdown = updatedProgress.skill_points_breakdown || {};
    // ======================================================
  
    // Prepare the response with deduplicated badges
    const allBadges = await Badge.find(
      { _id: { $in: updatedProgress.badges.map(b => b.badge ? b.badge : b) } },
      "name description type tagline points criteria hidden"
    );
    const uniqueBadges = {};
    const responseBadges = [];
  
    allBadges.forEach(badge => {
      if (!uniqueBadges[badge.name]) {
        uniqueBadges[badge.name] = true;
        responseBadges.push(badge);
      }
    });
    
    const totalBadgePoints = responseBadges.reduce((acc, badge) => acc + badge.points, 0);
    const uniqueLearnedSkillIds = [...new Set(updatedProgress.learnedSkills.map(id => id.toString()))];
    const fullLearnedSkills = await Skill.find({ _id: { $in: uniqueLearnedSkillIds } });
    
    res.status(200).json({
      message: "Module completed",
      progress: {
        completed_modules: updatedProgress.completed_modules,
        total_modules_completed: updatedProgress.completed_modules.length,
        module_points: updatedProgress.module_points,
        section_progress: updatedProgress.section_progress,
        total_sections_completed: updatedProgress.section_progress.filter(sp => sp.status === "completed").length,
        section_points: updatedProgress.section_points,
        theme_progress: updatedProgress.theme_progress,
        total_themes_completed: updatedProgress.theme_progress.filter(tp => tp.status === "completed").length,
        theme_points: updatedProgress.theme_points,
        total_points: updatedProgress.points,
        daily_points: updatedProgress.daily_points,
        weekly_points: updatedProgress.weekly_points,
        monthly_points: updatedProgress.monthly_points,
        badges: responseBadges,
        total_badge_points: totalBadgePoints,
        dailyStreak: updatedProgress.dailyStreak,
        maxDailyStreak: updatedProgress.maxDailyStreak, 
        weeklyStreak: updatedProgress.weeklyStreak,
        maxWeeklyStreak: updatedProgress.maxWeeklyStreak,
        consecutiveModules: updatedProgress.consecutiveModules,
        learnedSkills: fullLearnedSkills,
        skill_points_breakdown: responseSkillPointsBreakdown,
        total_skill_points: updatedProgress.skill_points
      },
    });
  } catch (error) {
    console.error("Error completing module:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


const getSkillChartData = async (req, res) => {
  try {
    const userId = req.user._id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user id provided." });
    }
    const progress = await UserProgress.findOne({ user_id: userId }).select("skill_points_breakdown skill_points");
    if (!progress) {
      return res.status(404).json({ message: "User progress not found." });
    }
    return res.status(200).json({
      skill_points_breakdown: progress.skill_points_breakdown,
      total_skill_points: progress.skill_points
    });
  } catch (error) {
    console.error("Error fetching skill chart data:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};
  
const getUserProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user id provided." });
    }

    // Important: DO NOT populate learnedSkills directly as it causes deduplication
    const progress = await UserProgress.findOne({ user_id: userId })
      .populate({
        path: "badges.badge",
        select: "name type description tagline points criteria hidden",
      });

    if (!progress) {
      return res.status(404).json({ message: "User progress not found." });
    }

    // Deduplicate badges (we still want each badge only once)
    const uniqueBadges = {};
    const badgesArray = [];
    if (progress.badges && progress.badges.length > 0) {
      progress.badges.forEach(badgeItem => {
        if (badgeItem.badge) {
          const badgeName = badgeItem.badge.name;
          if (!uniqueBadges[badgeName]) {
            uniqueBadges[badgeName] = true;
            badgesArray.push({
              _id: badgeItem.badge._id,
              name: badgeItem.badge.name,
              type: badgeItem.badge.type,
              description: badgeItem.badge.description,
              tagline: badgeItem.badge.tagline,
              points: badgeItem.badge.points,
              criteria: badgeItem.badge.criteria,
              hidden: badgeItem.badge.hidden,
              awarded_at: badgeItem.awarded_at
            });
          }
        }
      });
    }

    // For learnedSkills, we need to fetch the full details manually to maintain duplicates
    const skillsArray = [];
    if (progress.learnedSkills && progress.learnedSkills.length > 0) {
      // Get all unique skill IDs for fetching skill details
      const uniqueSkillIds = [...new Set(progress.learnedSkills.map(id => id.toString()))];
      
      // Fetch all skill details in one go
      const skillDetails = await Skill.find(
        { _id: { $in: uniqueSkillIds } },
        "_id skill_section skill_Name skill_description"
      );
      
      // Create a map for quick lookup
      const skillMap = {};
      skillDetails.forEach(skill => {
        skillMap[skill._id.toString()] = skill;
      });
      
      // Reconstruct the original array with duplicates, but with full details
      for (const skillId of progress.learnedSkills) {
        const id = skillId.toString();
        if (skillMap[id]) {
          skillsArray.push(skillMap[id]);
        }
      }
    }

    // Create a cleaned version of the progress object
    const cleanedProgress = {
      ...progress.toObject(),
      badges: badgesArray,
      learnedSkills: skillsArray,
      // Add a count of skills (including duplicates)
      skillsCount: progress.learnedSkills ? progress.learnedSkills.length : 0
    };

    // For debugging: add a count of unique skills to compare
    const uniqueSkillsCount = progress.learnedSkills ? 
      new Set(progress.learnedSkills.map(id => id.toString())).size : 0;
    
    cleanedProgress.uniqueSkillsCount = uniqueSkillsCount;

    res.status(200).json({ 
      progress: cleanedProgress,
      // For debugging:
      debug: {
        totalSkills: progress.learnedSkills ? progress.learnedSkills.length : 0,
        uniqueSkills: uniqueSkillsCount
      }
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

const userCompleteRanking = async (req, res) => {
  try {
    const user_id = req.user._id;

    const progressList = await UserProgress.find({})
      .populate("user_id", "username")
      .sort({ points: -1 });

    if (!progressList.length) {
      return res.status(404).json({ message: "No progress data found." });
    }

    // Get all user IDs from the progress list
    const userIds = progressList.map(item => item.user_id._id);

    // Fetch the onboarding records for these users
    const onboardingRecords = await Onboarding.find({ user_id: { $in: userIds } });
    // Create a map: user_id (string) -> onboarding record
    const onboardingMap = {};
    onboardingRecords.forEach(record => {
      onboardingMap[record.user_id.toString()] = record;
    });

    // ---------------- Overall Ranking ----------------
    const totalUsers = progressList.length;
    let overallRankedList = [];
    let lastPoints = null, lastOrdinalRank = 0, lastPercentile = 0;

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
      overallRankedList.push({
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
    const overallUserData = overallRankedList.find(
      item => item.user_id.toString() === user_id.toString()
    );
    if (!overallUserData) {
      return res.status(404).json({ message: "User not found in overall rankings." });
    }

    // ---------------- Retrieve Onboarding Data for the Current User ----------------
    const currentUserOnboarding = onboardingMap[user_id.toString()];
    if (!currentUserOnboarding) {
      return res.status(400).json({ message: "Onboarding data not found for current user." });
    }
    const userIndustry = currentUserOnboarding.industry;
    const userDepartment = currentUserOnboarding.department;
    if (!userIndustry) {
      return res.status(400).json({ message: "User industry not found in onboarding data." });
    }
    if (!userDepartment) {
      return res.status(400).json({ message: "User department not found in onboarding data." });
    }

    // ---------------- Industry Ranking ----------------
    const industryList = progressList.filter(item => {
      const onboarding = onboardingMap[item.user_id._id.toString()];
      return onboarding && onboarding.industry === userIndustry;
    });
    const totalIndustry = industryList.length;
    let industryRankedList = [];
    lastPoints = null; lastOrdinalRank = 0; lastPercentile = 0;
    for (let i = 0; i < totalIndustry; i++) {
      const current = industryList[i];
      let ordinalRank, percentile;
      if (i === 0) {
        ordinalRank = 1;
        percentile = Math.ceil(((i + 1) / totalIndustry) * 100);
      } else {
        if (current.points === lastPoints) {
          ordinalRank = lastOrdinalRank;
          percentile = lastPercentile;
        } else {
          ordinalRank = i + 1;
          percentile = Math.ceil(((i + 1) / totalIndustry) * 100);
        }
      }
      industryRankedList.push({
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
    const industryUserData = industryRankedList.find(
      item => item.user_id.toString() === user_id.toString()
    );
    if (!industryUserData) {
      return res.status(404).json({ message: "User not found in industry rankings." });
    }

    // ---------------- Department Ranking ----------------
    const departmentList = progressList.filter(item => {
      const onboarding = onboardingMap[item.user_id._id.toString()];
      return onboarding && onboarding.department === userDepartment;
    });
    const totalDepartment = departmentList.length;
    let departmentRankedList = [];
    lastPoints = null; lastOrdinalRank = 0; lastPercentile = 0;
    for (let i = 0; i < totalDepartment; i++) {
      const current = departmentList[i];
      let ordinalRank, percentile;
      if (i === 0) {
        ordinalRank = 1;
        percentile = Math.ceil(((i + 1) / totalDepartment) * 100);
      } else {
        if (current.points === lastPoints) {
          ordinalRank = lastOrdinalRank;
          percentile = lastPercentile;
        } else {
          ordinalRank = i + 1;
          percentile = Math.ceil(((i + 1) / totalDepartment) * 100);
        }
      }
      departmentRankedList.push({
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
    const departmentUserData = departmentRankedList.find(
      item => item.user_id.toString() === user_id.toString()
    );
    if (!departmentUserData) {
      return res.status(404).json({ message: "User not found in department rankings." });
    }

    // ---------------- Return Rankings with Counts and Names ----------------
    return res.status(200).json({
      message: "User rankings retrieved successfully",
      overall: {
        ranking: overallUserData,
        totalUsers
      },
      industry: {
        ranking: industryUserData,
        industryName: userIndustry,
        userCount: totalIndustry
      },
      department: {
        ranking: departmentUserData,
        departmentName: userDepartment,
        userCount: totalDepartment
      }
    });
  } catch (error) {
    console.error("Error retrieving rankings:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
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
  userCompleteRanking,
  getSkillChartData
};
