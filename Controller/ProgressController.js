const mongoose = require("mongoose");
const User = require("../Models/User");
const Module = require("../Models/Module");
const Section = require("../Models/Section");
const Theme = require("../Models/Theme");
const Badge = require("../Models/Badge");
const UserProgress = require('../Models/userProgress'); 
const UserLearning = require("../Models/Learning");
const Video = require("../Models/Video");
const Skill = require("../Models/Skill");
const Onboarding = require("../Models/Onboarding");

const awardBadgeOnce = async (progress, badgeName, targetPointsField) => {
  const allocatedBadgeIds = progress.badges.map(b => b.badge.toString());
  const badge = await Badge.findOne({ name: badgeName });
  if (badge && !allocatedBadgeIds.includes(badge._id.toString())) {
    progress.badges.push({ badge: badge._id, awarded_at: new Date() });
    if (targetPointsField && progress[targetPointsField] !== undefined) {
      progress[targetPointsField] += badge.points;
    }
    progress.points += badge.points;
    console.log(`Awarded badge "${badgeName}" for ${badge.points} points.`);
    return badge.points;
  }
  return 0;
};


// const awardSkillBadges = async (progress) => {
//   // Ensure skill_points and breakdown exist
//   if (typeof progress.skill_points !== 'number') {
//     progress.skill_points = 0;
//   }
//   if (!progress.skill_points_breakdown) {
//     progress.skill_points_breakdown = {};
//   }
  
//   if (!progress.learnedSkills || progress.learnedSkills.length === 0) {
//     console.log("No learned skills found in progress.");
//     return;
//   }
  
//   // Build frequency map from the full learnedSkills array
//   const skillCountMap = {};
//   progress.learnedSkills.forEach(id => {
//     const strId = id.toString();
//     skillCountMap[strId] = (skillCountMap[strId] || 0) + 1;
//   });
//   console.log("Skill count map:", skillCountMap);
  
//   // Create a list of unique learned skill IDs (for lookup)
//   const uniqueLearnedSkillIds = [...new Set(progress.learnedSkills.map(id => id.toString()))];
  
//   const fullSkills = await Skill.find({ _id: { $in: uniqueLearnedSkillIds } });
//   console.log("Full skills:", fullSkills);
  
//   // Reset skill points breakdown and total
//   progress.skill_points = 0;
//   progress.skill_points_breakdown = {};
  
//   // Initialize skill_points_breakdown for all skills to 0
//   fullSkills.forEach(skill => {
//     progress.skill_points_breakdown[skill.skill_Name] = 0;
//   });
  
//   // Define tiers with thresholds
//   const tiers = [
//     { tier: "Bronze", threshold: 1 },
//     { tier: "Silver", threshold: 3 },
//     { tier: "Gold", threshold: 5 },
//     { tier: "Platinum", threshold: 10 }
//   ];
  
//   // Get all badges already awarded
//   const awardedBadges = progress.badges || [];
//   const awardedBadgeIds = new Set(awardedBadges.map(b => b.badge.toString()));
  
//   // Create a lookup for badges by name
//   const allTierBadgeNames = [];
//   fullSkills.forEach(skill => {
//     tiers.forEach(tier => {
//       allTierBadgeNames.push(`${skill.skill_Name} ${tier.tier}`);
//     });
//   });
  
//   const allBadges = await Badge.find({ name: { $in: allTierBadgeNames } });
//   const badgesByName = {};
//   allBadges.forEach(badge => {
//     badgesByName[badge.name] = badge;
//   });
  
//   // Process each skill
//   for (const skill of fullSkills) {
//     const skillId = skill._id.toString();
//     const count = skillCountMap[skillId] || 0;
//     const skillName = skill.skill_Name;
    
//     // Each skill occurrence is worth 10 points
//     const pointsPerSkill = 10;
//     const skillPoints = count * pointsPerSkill;
    
//     // Award badges for each tier threshold that has been met
//     for (const { tier, threshold } of tiers) {
//       if (count >= threshold) {
//         const badgeName = `${skillName} ${tier}`;
//         const badge = badgesByName[badgeName];
        
//         if (badge) {
//           if (!awardedBadgeIds.has(badge._id.toString())) {
//             // Award new badge
//             progress.badges.push({ badge: badge._id, awarded_at: new Date() });
//             awardedBadgeIds.add(badge._id.toString());
            
//             // Display message for the badge award
//             // These messages are just for logging and don't affect the points
//             if (tier === "Silver") {
//               console.log(`Awarded ${badgeName}: +20 points.`);
//             } else {
//               console.log(`Awarded ${badgeName}: +0 additional points.`);
//             }
//           }
//         }
//       }
//     }
    
//     // Update the skill points in the breakdown
//     progress.skill_points_breakdown[skillName] = skillPoints;
//     progress.skill_points += skillPoints;
//   }
  
//   console.log("Updated skill points breakdown:", progress.skill_points_breakdown);
//   console.log("Total skill points:", progress.skill_points);
// };

const awardSkillBadges = async (progress) => {
  // Ensure skill_points and breakdown exist
  if (typeof progress.skill_points !== 'number') {
    progress.skill_points = 0;
  }
  if (!progress.skill_points_breakdown) {
    progress.skill_points_breakdown = {};
  }
  
  if (!progress.learnedSkills || progress.learnedSkills.length === 0) {
    console.log("No learned skills found in progress.");
    return;
  }
  
  // Build frequency map from the full learnedSkills array
  const skillCountMap = {};
  progress.learnedSkills.forEach(id => {
    const strId = id.toString();
    skillCountMap[strId] = (skillCountMap[strId] || 0) + 1;
  });
  console.log("Skill count map:", skillCountMap);
  
  // Create a list of unique learned skill IDs (for lookup)
  const uniqueLearnedSkillIds = [...new Set(progress.learnedSkills.map(id => id.toString()))];
  
  const fullSkills = await Skill.find({ _id: { $in: uniqueLearnedSkillIds } });
  console.log("Full skills:", fullSkills);
  
  // Store previous skill points before resetting
  const previousSkillPoints = progress.skill_points || 0;
  
  // Reset skill points breakdown and total
  progress.skill_points = 0;
  progress.skill_points_breakdown = {};
  
  // Initialize skill_points_breakdown for all skills to 0
  fullSkills.forEach(skill => {
    progress.skill_points_breakdown[skill.skill_Name] = 0;
  });
  
  // Define tiers with thresholds
  const tiers = [
    { tier: "Bronze", threshold: 1 },
    { tier: "Silver", threshold: 3 },
    { tier: "Gold", threshold: 5 },
    { tier: "Platinum", threshold: 10 }
  ];
  
  // Define bonus points for tiers (only for Silver, Gold, Platinum)
  const tierBonus = {
    Bronze: 0,      // Bronze badge doesn't add extra bonus (assumed to be included in badge.points)
    Silver: 20,
    Gold: 30,
    Platinum: 50
  };
  
  // Get all badges already awarded
  const awardedBadges = progress.badges || [];
  const awardedBadgeIds = new Set(awardedBadges.map(b => b.badge.toString()));
  
  // Create a lookup for badges by name for all tiered badges
  const allTierBadgeNames = [];
  fullSkills.forEach(skill => {
    tiers.forEach(tier => {
      allTierBadgeNames.push(`${skill.skill_Name} ${tier.tier}`);
    });
  });
  
  const allBadges = await Badge.find({ name: { $in: allTierBadgeNames } });
  const badgesByName = {};
  allBadges.forEach(badge => {
    badgesByName[badge.name] = badge;
  });
  
  // Process each skill
  for (const skill of fullSkills) {
    const skillId = skill._id.toString();
    const count = skillCountMap[skillId] || 0;
    const skillName = skill.skill_Name;
    
    // Each skill occurrence is worth 10 points
    const pointsPerSkill = 10;
    const skillPoints = count * pointsPerSkill;
    
    // Award badges for each tier threshold that has been met
    for (const { tier, threshold } of tiers) {
      if (count >= threshold) {
        const badgeName = `${skillName} ${tier}`;
        const badge = badgesByName[badgeName];
        
        if (badge && !awardedBadgeIds.has(badge._id.toString())) {
          // Award new badge
          progress.badges.push({ badge: badge._id, awarded_at: new Date() });
          awardedBadgeIds.add(badge._id.toString());
          
          // Add the bonus points for Silver, Gold, and Platinum tiers
          const bonus = tierBonus[tier] || 0;
          progress.points += bonus;
          console.log(`Awarded ${badgeName}: +${bonus} points.`);
        }
      }
    }
    
    // Update the skill points in the breakdown and total
    progress.skill_points_breakdown[skillName] = skillPoints;
    progress.skill_points += skillPoints;
  }
  
  console.log("Updated skill points breakdown:", progress.skill_points_breakdown);
  console.log("Total skill points:", progress.skill_points);
  
  // Update overall total points by adding the net increase in skill points
  progress.points += (progress.skill_points - previousSkillPoints);
};

const updateStreaks = async (progress) => {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  // Ensure streak counters are initialized
  progress.dailyStreak = progress.dailyStreak || 0;
  progress.maxDailyStreak = progress.maxDailyStreak || 0;
  progress.weeklyStreak = progress.weeklyStreak || 0;
  progress.maxWeeklyStreak = progress.maxWeeklyStreak || 0;
  progress.consecutiveModules = progress.consecutiveModules || 0;
  
  // Track modules completed by day (for the heat map)
  if (!progress.dailyModuleCount) {
    progress.dailyModuleCount = {};
  }
  
  // Initialize daily module count for today if not exists
  if (!progress.dailyModuleCount[todayStr]) {
    progress.dailyModuleCount[todayStr] = 0;
  }
  
  // Increment today's module count (for the heat map)
  progress.dailyModuleCount[todayStr] += 1;
  
  // Get today's module count after increment
  const todayModuleCount = progress.dailyModuleCount[todayStr];
  
  // Handle daily streak logic
  if (!progress.lastCompletionDate) {
    // First completion ever
    progress.dailyStreak = 1;
    progress.consecutiveModules = 1;
  } else {
    const lastDateStr = new Date(progress.lastCompletionDate).toISOString().split("T")[0];
    
    if (lastDateStr !== todayStr) {
      // Day has changed - reset consecutive modules counter to 1
      progress.consecutiveModules = 1;
      
      // Check if the last completion was exactly yesterday for dailyStreak
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      if (lastDateStr === yesterdayStr) {
        progress.dailyStreak += 1;
      } else {
        progress.dailyStreak = 1;
      }
    } else {
      // Same day - increment consecutive modules
      progress.consecutiveModules += 1;
    }
  }
  
  progress.lastCompletionDate = now;

  // Update the maximum daily streak if needed
  if (progress.dailyStreak > progress.maxDailyStreak) {
    progress.maxDailyStreak = progress.dailyStreak;
  }

  // Award streak badges
  if (progress.dailyStreak % 5 === 0 && progress.dailyStreak !== 0) {
    progress.weeklyStreak += 1;
    if (progress.weeklyStreak > progress.maxWeeklyStreak) {
      progress.maxWeeklyStreak = progress.maxWeeklyStreak;
    }
    await awardBadgeOnce(progress, "Daily Devotee");
  }
  if (progress.dailyStreak === 30) {
    await awardBadgeOnce(progress, "Weekly Warrior");
  }
  
  // Award badges based on modules completed in a single day
  if (todayModuleCount === 3) {
    await awardBadgeOnce(progress, "Triple Triumph");
  } else if (todayModuleCount === 5) {
    await awardBadgeOnce(progress, "Pentagon Pursuer");
  } else if (todayModuleCount === 10) {
    await awardBadgeOnce(progress, "Decathlon Achiever");
  }
  
  // Mark the dailyModuleCount object as modified to ensure Mongoose saves it
  progress.markModified('dailyModuleCount');
};
// const updateStreaks = async (progress) => {
//   const now = new Date();
//   const todayStr = now.toISOString().split("T")[0];

//   // Ensure streak counters are initialized.
//   progress.dailyStreak = progress.dailyStreak || 0;
//   progress.maxDailyStreak = progress.maxDailyStreak || 0;
//   progress.weeklyStreak = progress.weeklyStreak || 0;
//   progress.maxWeeklyStreak = progress.maxWeeklyStreak || 0;
//   progress.consecutiveModules = progress.consecutiveModules || 0;

//   // If there's no record of a previous completion, initialize everything.
//   if (!progress.lastCompletionDate) {
//     progress.dailyStreak = 1;
//   } else {
//     const lastDateStr = new Date(progress.lastCompletionDate).toISOString().split("T")[0];
//     if (lastDateStr !== todayStr) {
//       // Check if the last completion was exactly yesterday.
//       const yesterday = new Date(now);
//       yesterday.setDate(now.getDate() - 1);
//       const yesterdayStr = yesterday.toISOString().split("T")[0];

//       if (lastDateStr === yesterdayStr) {
//         progress.dailyStreak += 1;
//       } else {
//         progress.dailyStreak = 1;
//       }
//     }
//   }
//   progress.consecutiveModules += 1;
//   progress.lastCompletionDate = now;

//   // Update the maximum daily streak if needed.
//   if (progress.dailyStreak > progress.maxDailyStreak) {
//     progress.maxDailyStreak = progress.dailyStreak;
//   }

//   if (progress.dailyStreak % 5 === 0 && progress.dailyStreak !== 0) {
//     progress.weeklyStreak += 1;
//     if (progress.weeklyStreak > progress.maxWeeklyStreak) {
//       progress.maxWeeklyStreak = progress.weeklyStreak;
//     }
//     await awardBadgeOnce(progress, "Daily Devotee");
//   }
//   if (progress.dailyStreak === 30) {
//     await awardBadgeOnce(progress, "Weekly Warrior");
//   }
//   if (progress.consecutiveModules === 3) {
//     await awardBadgeOnce(progress, "Triple Triumph");
//   } else if (progress.consecutiveModules === 5) {
//     await awardBadgeOnce(progress, "Pentagon Pursuer");
//   } else if (progress.consecutiveModules === 10) {
//     await awardBadgeOnce(progress, "Decathlon Achiever");
//   }
// };

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
  
    if (typeof quizScore !== "number" || quizScore < 7) {
      return res.status(400).json({ message: "Quiz score too low to mark module as completed." });
    }
  
    // Find the module and populate its section details
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
  
    // Retrieve the entire UserLearning document for the user
    let userLearning = await UserLearning.findOne({ user_id: userId });
    if (!userLearning) {
      return res.status(404).json({ message: "User learning record not found." });
    }
  
    // Loop over all sections to find and update the module (in both arrays)
    let moduleFound = false;
    for (let section of userLearning.sections) {
      // Update in the modules array
      let mod = section.modules.find(mod => mod.module_id.toString() === module_id);
      if (mod) {
        mod.completed = true;
        mod.status = true; // per new schema
        mod.video_progress = 100;
        moduleFound = true;
      }
      // Update in the ai_recommendation array
      section.ai_recommendation.forEach((mod, index) => {
        if (mod.module_id.toString() === module_id) {
          mod.completed = true;
          mod.status = true;
          mod.video_progress = 100;
          if (!mod.order) {
            mod.order = index + 1;
          }
          moduleFound = true;
        }
      });
    }
  
    if (!moduleFound) {
      return res.status(404).json({ message: "Module not found in user learning record." });
    }
  
    // Mark the sections as modified so Mongoose saves the changes
    userLearning.markModified("sections");
  
    // --- Update progress document ---
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
    const badgesBefore = [...progress.badges.map(b => b.badge.toString())];
  
    if (progress.completed_modules.some(m => m.module_id.toString() === module_id)) {
      return res.status(400).json({ message: "Module already completed" });
    }
  
    const moduleBadge = await Badge.findOne({ name: "Completing Module" });
    let modulePointsEarned = 0;
    if (moduleBadge) {
      modulePointsEarned = moduleBadge.points;
      progress.module_points += moduleBadge.points;
      progress.points += moduleBadge.points;
      progress.badges.push({ badge: moduleBadge._id, awarded_at: new Date() });
    }
    progress.completed_modules.push({ module_id, completed_at: new Date(), points_earned: modulePointsEarned });
  
    // --- Update streaks ---
    await updateStreaks(progress);
  
    // --- Update section progress ---
    const modulesInSection = await Module.find({ section_id: sectionId }, "_id");
    const completedInSectionCount = progress.completed_modules.filter(m =>
      modulesInSection.some(mod => mod._id.toString() === m.module_id.toString())
    ).length;
    const sectionCompletionPercentage = Math.round(
      (completedInSectionCount / modulesInSection.length) * 100
    );
  
    let sectionProgress = progress.section_progress.find(
      sp => sp.section_id.toString() === sectionId.toString()
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
      sectionProgress.status =
        completedInSectionCount === modulesInSection.length ? "completed" : "in_progress";
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
  
    // --- Update theme progress ---
    let themeJustCompleted = false;
    if (themeId) {
      const sectionsInTheme = await Section.find({ theme_id: themeId }, "_id");
      const totalSections = sectionsInTheme.length;
      const completedSectionsCount = progress.section_progress.filter(sp =>
        sectionsInTheme.some(sec => sec._id.toString() === sp.section_id.toString() && sp.status === "completed")
      ).length;
      const themeCompletionPercentage = Math.round(
        (completedSectionsCount / totalSections) * 100
      );
  
      let themeProgress = progress.theme_progress.find(
        tp => tp.theme_id.toString() === themeId.toString()
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
        themeProgress.status =
          completedSectionsCount === totalSections ? "completed" : "in_progress";
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
  
    // --- Process learned skills and award skill badges ---
    const videosInModulePopulated = await Video.find({ module_id }).populate({
      path: "learnedSkills",
      select: "uniqueSkill_id skill_theme skill_Name skill_description"
    });
    console.log("Videos in module:", videosInModulePopulated);
  
    let moduleLearnedSkills = [];
    videosInModulePopulated.forEach(video => {
      if (video.learnedSkills && video.learnedSkills.length > 0) {
        moduleLearnedSkills = moduleLearnedSkills.concat(video.learnedSkills);
      }
    });
    console.log("Module learned skills:", moduleLearnedSkills);
  
    // Append new learned skills to progress.learnedSkills (do not deduplicate here to preserve counts)
    if (!progress.learnedSkills) {
      progress.learnedSkills = [];
    }
    moduleLearnedSkills.forEach(skill => {
      const skillId = skill._id ? skill._id : skill;
      progress.learnedSkills.push(skillId);
    });
    console.log("After updating learnedSkills:", progress.learnedSkills);
  
    await awardSkillBadges(progress);
  
    // --- Update points ---
    const pointsEarned = progress.points - pointsBefore;
  
    const currentDate = new Date();
  
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
    startOfWeek.setHours(0, 0, 0, 0); // Set to start of day

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999); // Set to end of day

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
  
    await progress.save();
    await userLearning.save();
  
    // Get newly earned badges
    const newlyEarnedBadgeIds = progress.badges
      .filter(b => !badgesBefore.includes(b.badge.toString()))
      .map(b => b.badge);
    
    const newlyEarnedBadges = await Badge.find(
      { _id: { $in: newlyEarnedBadgeIds } },
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
        badges: newlyEarnedBadges.map(badgeDoc => ({
          ...badgeDoc.toObject(),
          awarded_at: progress.badges.find(b => b.badge.toString() === badgeDoc._id.toString()).awarded_at
        })),
        total_badge_points: newlyEarnedBadges.reduce((acc, badge) => acc + badge.points, 0),
        dailyStreak: progress.dailyStreak,
        maxDailyStreak: progress.maxDailyStreak,
        weeklyStreak: progress.weeklyStreak,
        maxWeeklyStreak: progress.maxWeeklyStreak,
        consecutiveModules: progress.consecutiveModules,
        learnedSkills: progress.learnedSkills,
        skill_points_breakdown: progress.skill_points_breakdown,
        total_skill_points: progress.skill_points
      }
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
    
    // First, get the progress with populated badges
    const progress = await UserProgress.findOne({ user_id: userId })
      .populate({
        path: "badges.badge",
        select: "name type description tagline points criteria hidden"
      })
      .populate({
        path: "learnedSkills"
      });
    
    if (!progress) {
      return res.status(404).json({ message: "User progress not found." });
    }
    
    // Convert to plain object so we can modify it
    const progressObj = progress.toObject();
    
    // Transform badges from nested format to flattened format
    const flattenedBadges = progressObj.badges.map(badge => ({
      _id: badge.badge._id,
      name: badge.badge.name,
      type: badge.badge.type,
      description: badge.badge.description,
      tagline: badge.badge.tagline,
      points: badge.badge.points,
      criteria: badge.badge.criteria,
      hidden: badge.badge.hidden,
      awarded_at: badge.awarded_at
    }));
    
    // Replace the nested badges with the flattened format
    progressObj.badges = flattenedBadges;
    
    res.status(200).json({
      progress: progressObj
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
    
    // Create a combined dataset that includes both the daily_points data and module completions
    const combinedHeatData = [];
    
    // First, process the existing daily_points data
    const dailyPoints = progress.daily_points || [];
    dailyPoints.forEach(entry => {
      const dateStr = new Date(entry.date).toISOString().split("T")[0];
      combinedHeatData.push({
        date: dateStr,
        points: entry.points,
        modules: 0 // Default value, will be updated if we have module data
      });
    });
    
    // Process module completions to count by date
    const completedModules = progress.completed_modules || [];
    
    // Create a map to count modules by date
    const modulesByDate = {};
    
    completedModules.forEach(moduleEntry => {
      // Extract date from completed_at timestamp
      const completionDate = new Date(moduleEntry.completed_at);
      const dateStr = completionDate.toISOString().split("T")[0];
      
      // Increment the count for this date
      if (!modulesByDate[dateStr]) {
        modulesByDate[dateStr] = 1;
      } else {
        modulesByDate[dateStr] += 1;
      }
    });
    
    // Add module counts to heat data
    Object.keys(modulesByDate).forEach(dateStr => {
      const moduleCount = modulesByDate[dateStr];
      
      // Check if we already have an entry for this date in our combined data
      const existingEntryIndex = combinedHeatData.findIndex(entry => entry.date === dateStr);
      
      if (existingEntryIndex >= 0) {
        // Update existing entry with module count
        combinedHeatData[existingEntryIndex].modules = moduleCount;
      } else {
        // Create a new entry if none exists for this date
        combinedHeatData.push({
          date: dateStr,
          points: 0, // No points recorded for this day yet
          modules: moduleCount
        });
      }
    });
    
    // If dailyModuleCount exists, use that data as well (for newer implementations)
    if (progress.dailyModuleCount) {
      Object.keys(progress.dailyModuleCount).forEach(dateStr => {
        const moduleCount = progress.dailyModuleCount[dateStr];
        
        // Check if we already have an entry for this date in our combined data
        const existingEntryIndex = combinedHeatData.findIndex(entry => entry.date === dateStr);
        
        if (existingEntryIndex >= 0) {
          // Update existing entry with module count (prefer dailyModuleCount over derived count)
          combinedHeatData[existingEntryIndex].modules = moduleCount;
        } else {
          // Create a new entry if none exists for this date
          combinedHeatData.push({
            date: dateStr,
            points: 0, // No points recorded for this day yet
            modules: moduleCount
          });
        }
      });
    }
    
    // Sort the data by date
    const sortedHeatData = combinedHeatData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    res.status(200).json({ heatData: sortedHeatData });
  } catch (error) {
    console.error("Error retrieving daily points heat data:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// const getUserDailyPointsHeat = async (req, res) => {
//   try {
//     const userId = req.user._id;
    
//     if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
//       return res.status(400).json({ message: "Invalid user ID provided." });
//     }
//     const progress = await UserProgress.findOne({ user_id: userId });
//     if (!progress) {
//       return res.status(404).json({ message: "User progress not found." });
//     }
    
//     const heatData = (progress.daily_points || [])
//       .sort((a, b) => new Date(a.date) - new Date(b.date))
//       .map(entry => ({
//         date: entry.date.toISOString().split("T")[0],  
//         points: entry.points
//       }));
    
//     res.status(200).json({ heatData });
//   } catch (error) {
//     console.error("Error retrieving daily points heat data:", error);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// };

const userRanking = async (req, res) => {
  try {
    const progressList = await UserProgress.find({})
      .populate('user_id', 'username name email authMethod google apple')
      .sort({ points: -1 });
      
    // Filter out records where user_id is null or missing _id.
    const validProgressList = progressList.filter(item => item.user_id && item.user_id._id);
    const totalUsers = validProgressList.length;

    let rankedList = [];
    let lastPoints = null;
    let lastOrdinalRank = 0;
    let lastPercentile = 0;

    for (let i = 0; i < totalUsers; i++) {
      const current = validProgressList[i];
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

      // Extract username using proper fallbacks based on auth method
      let username = "";
      const user = current.user_id;
      
      if (user) {
        const authMethod = user.authMethod;
        
        if (authMethod === "local") {
          // For local users, use username if available, otherwise name
          username = user.username || user.name || "";
        } else if (authMethod === "google" && user.google && user.google.userInfo) {
          // For Google users
          const googleInfo = user.google.userInfo;
          if (googleInfo.name) {
            username = googleInfo.name;
          } else {
            const given = googleInfo.givenName || "";
            const family = googleInfo.familyName || "";
            username = [given, family].filter(part => part && part.trim()).join(" ");
          }
        } else if (authMethod === "apple" && user.apple) {
          // For Apple users
          const appleData = user.apple;
          if (appleData.userInfo && appleData.userInfo.name) {
            username = appleData.userInfo.name;
          } else if (appleData.fullName && appleData.fullName.givenName) {
            const given = appleData.fullName.givenName;
            const family = appleData.fullName.familyName || "";
            username = [given, family].filter(part => part && part.trim()).join(" ");
          }
          
          // If still no username, derive from email
          if (!username && user.email) {
            const localPart = user.email.split("@")[0];
            username = localPart.replace(/[\._]/g, " ");
            username = username.charAt(0).toUpperCase() + username.slice(1);
          }
        } else {
          // Default fallback
          username = user.username || user.name || "";
        }
        
        // Final fallback - if still no username, use email or User ID
        if (!username || username.trim() === "") {
          username = user.email ? user.email.split("@")[0] : `User ${user._id.toString().slice(-4)}`;
        }
      }

      rankedList.push({
        user_id: current.user_id._id,
        username: username, // Use our extracted username
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
      .populate('user_id', 'username name email authMethod google apple')
      .sort({ points: -1 });
      
    // Filter out records with null user_id to prevent errors.
    const validProgressList = progressList.filter(item => item.user_id && item.user_id._id);
    const totalUsers = validProgressList.length;
    
    let rankedList = [];
    let lastPoints = null;
    let lastOrdinalRank = 0;
    let lastPercentile = 0;
    
    for (let i = 0; i < totalUsers; i++) {
      const current = validProgressList[i];
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
  
      // Extract username using proper fallbacks based on auth method
      let username = "";
      const user = current.user_id;
      
      if (user) {
        const authMethod = user.authMethod;
        
        if (authMethod === "local") {
          // For local users, use username if available, otherwise name
          username = user.username || user.name || "";
        } else if (authMethod === "google" && user.google && user.google.userInfo) {
          // For Google users
          const googleInfo = user.google.userInfo;
          if (googleInfo.name) {
            username = googleInfo.name;
          } else {
            const given = googleInfo.givenName || "";
            const family = googleInfo.familyName || "";
            username = [given, family].filter(part => part && part.trim()).join(" ");
          }
        } else if (authMethod === "apple" && user.apple) {
          // For Apple users
          const appleData = user.apple;
          if (appleData.userInfo && appleData.userInfo.name) {
            username = appleData.userInfo.name;
          } else if (appleData.fullName && appleData.fullName.givenName) {
            const given = appleData.fullName.givenName;
            const family = appleData.fullName.familyName || "";
            username = [given, family].filter(part => part && part.trim()).join(" ");
          }
          
          // If still no username, derive from email
          if (!username && user.email) {
            const localPart = user.email.split("@")[0];
            username = localPart.replace(/[\._]/g, " ");
            username = username.charAt(0).toUpperCase() + username.slice(1);
          }
        } else {
          // Default fallback
          username = user.username || user.name || "";
        }
        
        // Final fallback - if still no username, use email or User ID
        if (!username || username.trim() === "") {
          username = user.email ? user.email.split("@")[0] : `User ${user._id.toString().slice(-4)}`;
        }
      }
  
      rankedList.push({
        user_id: current.user_id._id,
        username: username, // Use our extracted username
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
      .populate("user_id", "username name email authMethod google apple")
      .sort({ points: -1 });

    // Filter out records with null user_id to prevent errors.
    const validProgressList = progressList.filter(item => item.user_id && item.user_id._id);

    if (!validProgressList.length) {
      return res.status(404).json({ message: "No progress data found." });
    }

    // Get all user IDs from the valid progress list
    const userIds = validProgressList.map(item => item.user_id._id);

    // Fetch the onboarding records for these users
    const onboardingRecords = await Onboarding.find({ user_id: { $in: userIds } });
    // Create a map: user_id (string) -> onboarding record
    const onboardingMap = {};
    onboardingRecords.forEach(record => {
      onboardingMap[record.user_id.toString()] = record;
    });

    // ---------------- Overall Ranking ----------------
    const totalUsers = validProgressList.length;
    let overallRankedList = [];
    let lastPoints = null, lastOrdinalRank = 0, lastPercentile = 0;

    for (let i = 0; i < totalUsers; i++) {
      const current = validProgressList[i];
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
      
      // Extract username using proper fallbacks based on auth method
      let username = "";
      const user = current.user_id;
      
      if (user) {
        const authMethod = user.authMethod;
        
        if (authMethod === "local") {
          // For local users, use username if available, otherwise name
          username = user.username || user.name || "";
        } else if (authMethod === "google" && user.google && user.google.userInfo) {
          // For Google users
          const googleInfo = user.google.userInfo;
          if (googleInfo.name) {
            username = googleInfo.name;
          } else {
            const given = googleInfo.givenName || "";
            const family = googleInfo.familyName || "";
            username = [given, family].filter(part => part && part.trim()).join(" ");
          }
        } else if (authMethod === "apple" && user.apple) {
          // For Apple users
          const appleData = user.apple;
          if (appleData.userInfo && appleData.userInfo.name) {
            username = appleData.userInfo.name;
          } else if (appleData.fullName && appleData.fullName.givenName) {
            const given = appleData.fullName.givenName;
            const family = appleData.fullName.familyName || "";
            username = [given, family].filter(part => part && part.trim()).join(" ");
          }
          
          // If still no username, derive from email
          if (!username && user.email) {
            const localPart = user.email.split("@")[0];
            username = localPart.replace(/[\._]/g, " ");
            username = username.charAt(0).toUpperCase() + username.slice(1);
          }
        } else {
          // Default fallback
          username = user.username || user.name || "";
        }
        
        // Final fallback - if still no username, use email or User ID
        if (!username || username.trim() === "") {
          username = user.email ? user.email.split("@")[0] : `User ${user._id.toString().slice(-4)}`;
        }
      }
      
      overallRankedList.push({
        user_id: current.user_id._id,
        username: username, // Use our extracted username
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
    const industryList = validProgressList.filter(item => {
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
      
      // Find the matching user in the overallRankedList to get the username
      const userEntry = overallRankedList.find(item => 
        item.user_id.toString() === current.user_id._id.toString()
      );
      
      industryRankedList.push({
        user_id: current.user_id._id,
        username: userEntry ? userEntry.username : "Unknown User",
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
    const departmentList = validProgressList.filter(item => {
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
      
      // Find the matching user in the overallRankedList to get the username
      const userEntry = overallRankedList.find(item => 
        item.user_id.toString() === current.user_id._id.toString()
      );
      
      departmentRankedList.push({
        user_id: current.user_id._id,
        username: userEntry ? userEntry.username : "Unknown User",
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