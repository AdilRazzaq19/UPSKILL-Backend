const mongoose = require("mongoose");
const UserLearning = require("../Models/Learning");
const Section = require("../Models/Section");
const Module = require("../Models/Module");
const UserProgress = require("../Models/userProgress");

const addUserLearningByModule = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { module_id } = req.body;

    // Validate module_id
    if (!module_id || !mongoose.Types.ObjectId.isValid(module_id)) {
      return res.status(400).json({ message: "Invalid module ID provided." });
    }

    // Find the module and populate its section and theme
    const moduleDoc = await Module.findById(module_id).populate({
      path: "section_id",
      populate: { path: "theme_id" }
    });

    if (!moduleDoc) {
      return res.status(404).json({ message: "Module not found" });
    }
    if (!moduleDoc.section_id) {
      return res.status(404).json({ message: "Section not found for this module" });
    }
    if (!moduleDoc.section_id.theme_id) {
      return res.status(404).json({ message: "Theme not found for this section" });
    }

    const section_id = moduleDoc.section_id._id;
    const section_name = moduleDoc.section_id.name;
    const modName = moduleDoc.name;
    const uniqueModuleID = moduleDoc.unique_ModuleID;
    const theme_id = moduleDoc.section_id.theme_id._id;
    const theme_name = moduleDoc.section_id.theme_id.name;

    console.log("Section ID:", section_id);
    console.log("Section Name:", section_name);
    console.log("Module Name:", modName);
    console.log("Unique Module ID:", uniqueModuleID);
    console.log("Theme ID:", theme_id);
    console.log("Theme Name:", theme_name);

    // Find (or create) the consolidated UserLearning document for the user.
    let userLearning = await UserLearning.findOne({ user_id });
    if (!userLearning) {
      userLearning = new UserLearning({ user_id, sections: [] });
    }

    // Look for an existing section entry within the document.
    let sectionEntry = userLearning.sections.find(sec =>
      sec.section_id.toString() === section_id.toString()
    );

    if (!sectionEntry) {
      // Create a new section entry if not found.
      sectionEntry = {
        section_id,
        theme_id,
        modules: [],
        ai_recommendation: []
      };
      userLearning.sections.push(sectionEntry);
    }

    // Check if the module is already added (either in user-preferred modules or AI recommendations)
    const moduleAlreadyAdded =
      sectionEntry.modules.some(m => m.module_id.toString() === moduleDoc._id.toString()) ||
      sectionEntry.ai_recommendation.some(m => m.module_id.toString() === moduleDoc._id.toString());

    if (moduleAlreadyAdded) {
      return res.status(400).json({ message: "This module is already in your learning list." });
    }

    // Determine the order for the new module based on existing user-preferred modules.
    const newModuleOrder = sectionEntry.modules.length + 1;

    // Add the new module with the order field to the user-preferred modules array.
    sectionEntry.modules.push({
      order: newModuleOrder,
      module_id: moduleDoc._id,
      unique_ModuleID: uniqueModuleID,
      module_name: modName,
      completed: false,
    });

    await userLearning.save();
    console.log("Module added to UserLearning for section:", section_name);

    // Update user progress separately (if needed)
    let userProgress = await UserProgress.findOne({ user_id });
    if (!userProgress) {
      userProgress = new UserProgress({
        user_id,
        section_progress: [],
        completed_modules: []
      });
    }
    const sectionExists = userProgress.section_progress.find(
      sec => sec.section_id.toString() === section_id.toString()
    );
    if (!sectionExists) {
      userProgress.section_progress.push({
        section_id,
        status: "in_progress"
      });
    }
    await userProgress.save();

    res.status(201).json({
      message: "Module added successfully",
      data: {
        theme: theme_name,
        section: section_name,
        module: modName,
      }
    });
  } catch (error) {
    console.error("Error adding module to learning:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};


const addUserLearningByUniqueModule = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { module_id } = req.body; // Here module_id is the unique module identifier

    if (!module_id) {
      return res.status(400).json({ message: "Module ID is required." });
    }

    // Find the module by its unique_ModuleID and populate its section and theme.
    const moduleDoc = await Module.findOne({ unique_ModuleID: module_id }).populate({
      path: "section_id",
      populate: { path: "theme_id" }
    });

    if (!moduleDoc) {
      return res.status(404).json({ message: "Module not found" });
    }
    if (!moduleDoc.section_id) {
      return res.status(404).json({ message: "Section not found for this module" });
    }
    if (!moduleDoc.section_id.theme_id) {
      return res.status(404).json({ message: "Theme not found for this section" });
    }

    const section_id = moduleDoc.section_id._id;
    const section_name = moduleDoc.section_id.name;
    const modName = moduleDoc.name;
    // Ensure we use a consistent variable name and store as string.
    const uniqueModuleID = moduleDoc.unique_ModuleID.toString();
    const theme_id = moduleDoc.section_id.theme_id._id;
    const theme_name = moduleDoc.section_id.theme_id.name;

    console.log("Section ID:", section_id);
    console.log("Section Name:", section_name);
    console.log("Module Name:", modName);
    console.log("Unique Module ID:", uniqueModuleID);
    console.log("Theme ID:", theme_id);
    console.log("Theme Name:", theme_name);

    // Get the latest UserLearning document for this user.
    let userLearning = await UserLearning.findOne({ user_id });
    if (!userLearning) {
      userLearning = new UserLearning({ user_id, sections: [] });
      await userLearning.save();
      console.log("Created new UserLearning document for user.");
    }

    // Ensure the sections array exists.
    if (!userLearning.sections) {
      userLearning.sections = [];
    }

    // Look for an existing section entry for the current section.
    let sectionEntry = userLearning.sections.find(sec =>
      sec.section_id.toString() === section_id.toString()
    );
    if (!sectionEntry) {
      // Create a new section entry if not found.
      sectionEntry = {
        section_id,
        theme_id,
        modules: [],
        ai_recommendation: []
      };
      userLearning.sections.push(sectionEntry);
      userLearning.markModified("sections");
      console.log(`Created new section entry for section: ${section_name}`);
    }

    // Ensure that the arrays exist in the section entry.
    if (!sectionEntry.modules) sectionEntry.modules = [];
    if (!sectionEntry.ai_recommendation) sectionEntry.ai_recommendation = [];

    // Check for duplicate module (using unique_ModuleID)
    const existsInModules = sectionEntry.modules.some(mod => {
      return mod.unique_ModuleID && mod.unique_ModuleID.toString() === uniqueModuleID;
    });
    const existsInAIRec = sectionEntry.ai_recommendation.some(rec => {
      return rec.unique_ModuleID && rec.unique_ModuleID.toString() === uniqueModuleID;
    });
    if (existsInModules || existsInAIRec) {
      return res.status(400).json({ message: "This module is already in your learning preferences." });
    }

    // Determine the order for the new module.
    const newModuleOrder = sectionEntry.modules.length + 1;

    // Add the new module to the modules array.
    sectionEntry.modules.push({
      module_id: moduleDoc._id,
      unique_ModuleID: uniqueModuleID,
      module_name: modName,
      completed: false,
      order: newModuleOrder
    });
    console.log(`Module "${modName}" added to section "${section_name}".`);

    // Save the updated UserLearning document and re-fetch to ensure fresh data.
    await userLearning.save();
    userLearning = await UserLearning.findOne({ user_id });
    console.log("UserLearning document saved and re-fetched.");

    // Update user progress (this part remains unchanged)
    let userProgress = await UserProgress.findOne({ user_id });
    if (!userProgress) {
      userProgress = new UserProgress({
        user_id,
        section_progress: [],
        completed_modules: []
      });
      console.log("Created new UserProgress document for user.");
    }
    const sectionExists = userProgress.section_progress.find(
      sec => sec.section_id.toString() === section_id.toString()
    );
    if (!sectionExists) {
      userProgress.section_progress.push({
        section_id,
        status: "in_progress"
      });
    }
    await userProgress.save();
    console.log("UserProgress updated.");

    res.status(201).json({
      message: "Module added successfully",
      data: {
        theme: theme_name,
        section: section_name,
        module: modName,
      }
    });
  } catch (error) {
    console.error("Error adding module to learning:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};



const checkUserLearningModule = async (req, res) => {
  try {
    const user_id = req.user.id; // or req.user._id, depending on your middleware
    const { module_id } = req.body;

    if (!module_id) {
      return res.status(400).json({ exists: false, message: "Module ID is required." });
    }

    // Find the module using its unique module identifier and populate its section and theme.
    const moduleDoc = await Module.findOne({ unique_ModuleID: module_id }).populate({
      path: "section_id",
      populate: { path: "theme_id" }
    });

    if (!moduleDoc) {
      return res.status(404).json({ exists: false, message: "Module not found." });
    }
    if (!moduleDoc.section_id) {
      return res.status(404).json({ exists: false, message: "Section not found for this module." });
    }

    // Retrieve the consolidated UserLearning document for this user.
    const userLearning = await UserLearning.findOne({ user_id });
    if (!userLearning) {
      return res.status(200).json({ exists: false, message: "Module does not exist in your learning preferences." });
    }

    // Find the section entry matching the module's section.
    const sectionEntry = userLearning.sections.find(
      sec => sec.section_id.toString() === moduleDoc.section_id._id.toString()
    );
    if (!sectionEntry) {
      return res.status(200).json({ exists: false, message: "Module does not exist in your learning preferences." });
    }

    // Check if the module exists in either the user-preferred modules or the AI recommendations.
    const existsInModules = sectionEntry.modules.some(
      mod => mod.unique_ModuleID === moduleDoc.unique_ModuleID
    );
    const existsInAIRec = sectionEntry.ai_recommendation.some(
      mod => mod.unique_ModuleID === moduleDoc.unique_ModuleID
    );

    if (existsInModules || existsInAIRec) {
      return res.status(200).json({ exists: true, message: "Module already exists in your learning preferences." });
    } else {
      return res.status(200).json({ exists: false, message: "Module does not exist in your learning preferences." });
    }
  } catch (error) {
    console.error("Error checking user learning module:", error);
    res.status(500).json({ exists: false, message: "Internal server error", error: error.message });
  }
};



const getUserLearningProgress = async (req, res) => {
  try {
    const user_id = req.user.id;

    // Since we now have a consolidated UserLearning document per user,
    // we use findOne instead of find.
    const userLearning = await UserLearning.findOne({ user_id })
      .populate({
        path: "sections.section_id",
        select: "name"
      })
      .populate({
        path: "sections.theme_id",
        select: "name"
      })
      .populate({
        path: "sections.modules.module_id",
        select: "name video",
        populate: {
          path: "video",
          select: "channel_name"
        }
      })
      .populate({
        path: "sections.ai_recommendation.module_id",
        select: "name video",
        populate: {
          path: "video",
          select: "channel_name"
        }
      });

    if (!userLearning) {
      return res.status(404).json({ message: "No learning progress found for this user" });
    }

    let totalModuleCount = 0;
    let totalAiRecommendationCount = 0;
    const aiRecommendationsBySection = {};
    const userPreferenceBySection = {};

    // Iterate over each section in the consolidated document.
    userLearning.sections.forEach(section => {
      // Extract section details from the populated section_id.
      const sec = section.section_id
        ? { id: section.section_id._id, name: section.section_id.name }
        : { id: "unknown", name: "Unknown Section" };
      const secId = sec.id.toString();

      // Process AI recommendation modules for this section.
      section.ai_recommendation.forEach(rec => {
        const moduleObj = {
          id: rec.module_id ? rec.module_id._id : null,
          name: rec.module_id ? rec.module_id.name : rec.module_name || "Unknown Module",
          completed: rec.completed,
          video: rec.module_id && rec.module_id.video
            ? { channelName: rec.module_id.video.channel_name }
            : {},
          aiModuleTitle: rec.ai_module_title || null,
          relevanceStatement: rec.relevance_statement || null
        };

        if (!aiRecommendationsBySection[secId]) {
          aiRecommendationsBySection[secId] = { ...sec, modules: [] };
        }
        aiRecommendationsBySection[secId].modules.push(moduleObj);
        totalAiRecommendationCount++;
      });

      // Process user-preferred modules for this section.
      section.modules.forEach(mod => {
        const moduleObj = {
          id: mod.module_id ? mod.module_id._id : null,
          name: mod.module_id ? mod.module_id.name : mod.module_name || "Unknown Module",
          completed: mod.completed,
          video: mod.module_id && mod.module_id.video
            ? { channelName: mod.module_id.video.channel_name }
            : {},
          aiModuleTitle: mod.ai_module_title || null,
          relevanceStatement: mod.relevance_statement || null
        };

        if (!userPreferenceBySection[secId]) {
          userPreferenceBySection[secId] = { ...sec, modules: [] };
        }
        userPreferenceBySection[secId].modules.push(moduleObj);
        totalModuleCount++;
      });
    });

    const formattedProgress = {
      totalAiRecommendationCount,
      totalModuleCount,
      aiRecommendations: Object.values(aiRecommendationsBySection),
      userPreferenceModules: Object.values(userPreferenceBySection)
    };

    return res.status(200).json(formattedProgress);
  } catch (error) {
    console.error("Error getting learning progress:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

const getAllLearningModules = async (req, res) => {
  try {
    const user_id = req.user.id;

    // Retrieve the consolidated UserLearning document for the user.
    const userLearning = await UserLearning.findOne({ user_id })
      .populate({
        path: "sections.section_id",
        select: "name"
      })
      .populate({
        path: "sections.modules.module_id",
        select: "name video",
        populate: {
          path: "video",
          select: "channel_name"
        }
      })
      .populate({
        path: "sections.ai_recommendation.module_id",
        select: "name video",
        populate: {
          path: "video",
          select: "channel_name"
        }
      });

    if (!userLearning) {
      return res.status(404).json({ message: "No learning progress found for this user" });
    }

    // Create a flat list of modules from all sections.
    let allModules = [];
    userLearning.sections.forEach(section => {
      // Process regular modules.
      if (section.modules && Array.isArray(section.modules)) {
        section.modules.forEach(mod => {
          const moduleObj = {
            id: mod.module_id ? mod.module_id._id : null,
            name: mod.module_id ? mod.module_id.name : mod.module_name || "Unknown Module",
            completed: mod.completed,
            video: mod.module_id && mod.module_id.video
              ? { channelName: mod.module_id.video.channel_name }
              : {}
          };
          allModules.push(moduleObj);
        });
      }
      // Process AI recommendation modules.
      if (section.ai_recommendation && Array.isArray(section.ai_recommendation)) {
        section.ai_recommendation.forEach(rec => {
          const moduleObj = {
            id: rec.module_id ? rec.module_id._id : null,
            name: rec.module_id ? rec.module_id.name : rec.module_name || "Unknown Module",
            completed: rec.completed,
            video: rec.module_id && rec.module_id.video
              ? { channelName: rec.module_id.video.channel_name }
              : {}
          };
          allModules.push(moduleObj);
        });
      }
    });

    return res.status(200).json({ 
      modules: allModules, 
      count: allModules.length 
    });
  } catch (error) {
    console.error("Error getting all learning modules:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};



const updateUserLearningProgress = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { module_id } = req.body;

    // Validate required field
    if (!module_id) {
      return res.status(400).json({ message: "Module ID is required" });
    }

    // For this update, we only mark a module as completed (since our schema no longer has videos)
    let userLearning = await UserLearning.findOne({
      user_id,
      "modules.module_id": module_id
    });
    if (!userLearning) {
      return res.status(404).json({ message: "User learning record not found for this module" });
    }

    const moduleIndex = userLearning.modules.findIndex(
      mod => mod.module_id.toString() === module_id
    );
    if (moduleIndex === -1) {
      return res.status(404).json({ message: "Module not found in user learning" });
    }

    // Mark the module as completed
    userLearning.modules[moduleIndex].completed = true;

    await userLearning.save();

    // Update user progress: add module to completed_modules if not already there,
    // and if all modules in the section are completed, mark the section as completed.
    let userProgress = await UserProgress.findOne({ user_id });
    if (!userProgress) {
      userProgress = new UserProgress({
        user_id,
        section_progress: [],
        completed_modules: []
      });
    }
    const moduleExists = userProgress.completed_modules.some(
      mod => mod.module_id.toString() === module_id
    );
    if (!moduleExists) {
      userProgress.completed_modules.push({
        module_id,
        completed_at: new Date()
      });
      await userProgress.save();
    }
    const allModulesCompleted = userLearning.modules.every(mod => mod.completed);
    if (allModulesCompleted) {
      let up = await UserProgress.findOne({ user_id });
      if (up) {
        const sectionIndex = up.section_progress.findIndex(
          sec => sec.section_id.toString() === userLearning.section_id.toString()
        );
        if (sectionIndex !== -1) {
          up.section_progress[sectionIndex].status = "completed";
          await up.save();
        }
      }
    }

    res.status(200).json({
      message: "Progress updated successfully",
      module_completed: userLearning.modules[moduleIndex].completed
    });
  } catch (error) {
    console.error("Error updating learning progress:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

const removeUserLearningModule = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { module_id } = req.params;

    // Find the user learning record containing the module
    const userLearning = await UserLearning.findOne({
      user_id,
      "modules.module_id": module_id
    });

    if (!userLearning) {
      return res.status(404).json({ message: "Learning module not found" });
    }

    userLearning.modules = userLearning.modules.filter(
      mod => mod.module_id.toString() !== module_id
    );
    if (userLearning.modules.length === 0) {
      await UserLearning.deleteOne({ _id: userLearning._id });
      await UserProgress.updateOne(
        { user_id },
        { $pull: { section_progress: { section_id: userLearning.section_id } } }
      );
      return res.status(200).json({ message: "Module removed successfully. No modules remain in this section." });
    } else {
      await userLearning.save();
    }

    // Remove the module from completed_modules in UserProgress if it exists
    await UserProgress.updateOne(
      { user_id },
      { $pull: { completed_modules: { module_id } } }
    );

    res.status(200).json({ message: "Module removed successfully" });
  } catch (error) {
    console.error("Error removing learning module:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

const getLearningModuleById = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { module_id } = req.params; // Module ID passed as a route parameter

    if (!module_id) {
      return res.status(400).json({ message: "Module ID is required" });
    }

    // Retrieve all UserLearning documents for the user with proper population.
    const userLearnings = await UserLearning.find({ user_id })
      .populate({
        path: "modules.module_id",
        select: "name video",
        populate: {
          path: "video",
          select: "channel_name likes_count views_count publish_date"
        }
      })
      .populate({
        path: "ai_recommendation.module_id",
        select: "name video",
        populate: {
          path: "video",
          select: "channel_name likes_count views_count publish_date"
        }
      });

    if (!userLearnings || userLearnings.length === 0) {
      return res.status(404).json({ message: "No learning progress found for this user" });
    }

    let foundModule = null;

    // Iterate over each learning record to search both arrays.
    userLearnings.forEach(learning => {
      // Check the modules array
      learning.modules.forEach(mod => {
        if (mod.module_id && mod.module_id._id.toString() === module_id) {
          foundModule = {
            id: mod.module_id._id,
            name: mod.module_id.name || mod.module_name || "Unknown Module",
            completed: mod.completed,
            video: mod.module_id && mod.module_id.video
              ? {
                  channelName: mod.module_id.video.channel_name,
                  publish_date: mod.module_id.video.publish_date,
                  likes_count: mod.module_id.video.likes_count,
                  views_count: mod.module_id.video.views_count
                }
              : {},
            aiModuleTitle: mod.ai_module_title || null,
            relevanceStatement: mod.relevance_statement || null
          };
        }
      });

      // If not found, check the ai_recommendation array.
      if (!foundModule) {
        learning.ai_recommendation.forEach(rec => {
          if (rec.module_id && rec.module_id._id.toString() === module_id) {
            foundModule = {
              id: rec.module_id._id,
              name: rec.module_id.name || rec.module_name || "Unknown Module",
              completed: rec.completed,
              video: rec.module_id && rec.module_id.video
                ? {
                    channelName: rec.module_id.video.channel_name,
                    publish_date: rec.module_id.video.publish_date,
                    likes_count: rec.module_id.video.likes_count,
                    views_count: rec.module_id.video.views_count
                  }
                : {},
              aiModuleTitle: rec.ai_module_title || null,
              relevanceStatement: rec.relevance_statement || null
            };
          }
        });
      }
    });

    if (foundModule) {
      return res.status(200).json(foundModule);
    } else {
      return res.status(404).json({ message: "Module not found in your learning progress" });
    }
  } catch (error) {
    console.error("Error fetching learning module by ID:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

module.exports = {
  addUserLearningByModule,
  addUserLearningByUniqueModule,
  checkUserLearningModule,
  getUserLearningProgress,
  updateUserLearningProgress,
  removeUserLearningModule,
  getAllLearningModules,
  getLearningModuleById 
};
