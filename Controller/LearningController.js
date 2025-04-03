const mongoose = require("mongoose");
const UserLearning = require("../Models/Learning");
const Section = require("../Models/Section");
const Module = require("../Models/Module");
const UserProgress = require("../Models/userProgress");

// Add a module by its Mongo _id (from the database)
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

    // Check if the module is already in the learning list
    let existingLearning = await UserLearning.findOne({
      user_id,
      section_id,
      $or: [
        { "modules.module_id": moduleDoc._id },
        { "ai_recommendation.module_id": moduleDoc._id }
      ]
    });
    if (existingLearning) {
      return res.status(400).json({ message: "This module is already in your learning list." });
    }

    // Find or create the UserLearning document for this section.
    let userLearning = await UserLearning.findOne({ user_id, section_id });
    if (!userLearning) {
      userLearning = new UserLearning({
        user_id,
        theme_id,
        section_id,
        modules: [],
        ai_recommendation: []
      });
    } else {
      // Ensure each existing module has an order
      userLearning.modules = userLearning.modules.map((module, index) => {
        if (!module.order) {
          module.order = index + 1;
        }
        return module;
      });
      // Ensure each existing ai_recommendation has an order
      userLearning.ai_recommendation = userLearning.ai_recommendation.map((rec, index) => {
        if (!rec.order) {
          rec.order = index + 1;
        }
        return rec;
      });
    }

    // Determine the order for the new module
    const newModuleOrder = userLearning.modules.length + 1;

    // Add the new module with an order field
    userLearning.modules.push({
      module_id: moduleDoc._id,
      unique_ModuleID: uniqueModuleID,
      module_name: modName,
      completed: false,
      order: newModuleOrder,
      // videos: formattedVideos, // Include if needed.
    });

    await userLearning.save();
    console.log("Module added to UserLearning for section:", section_name);

    // Update user progress
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
    const { module_id } = req.body;

    if (!module_id) {
      return res.status(400).json({ message: "Module ID is required." });
    }
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
    const uniqueModuleID = moduleDoc.unique_ModuleID;
    const theme_id = moduleDoc.section_id.theme_id._id;
    const theme_name = moduleDoc.section_id.theme_id.name;
    
    let userLearning = await UserLearning.findOne({ user_id, section_id });
    
    if (userLearning) {
      console.log("Found existing UserLearning record:", userLearning._id.toString());
      console.log("moduleDoc.unique_ModuleID:", uniqueModuleID);
      
      // Ensure each existing module has an order field
      userLearning.modules = userLearning.modules.map((mod, index) => {
        if (!mod.order) {
          mod.order = index + 1;
        }
        return mod;
      });
      
      // Ensure each recommendation in ai_recommendation has an order field
      userLearning.ai_recommendation = userLearning.ai_recommendation.map((mod, index) => {
        if (!mod.order) {
          mod.order = index + 1;
        }
        return mod;
      });
      
      // Optional: Filter modules to only those with a unique_ModuleID
      userLearning.modules = userLearning.modules.filter(mod => mod.unique_ModuleID);
      
      await userLearning.populate("ai_recommendation.module_id");
      
      let existsInModules = false;
      for (const mod of userLearning.modules) {
        console.log("modules - stored unique_ModuleID:", mod.unique_ModuleID);
        if (mod.unique_ModuleID === uniqueModuleID) {
          existsInModules = true;
          break;
        }
      }
      let existsInAIRec = false;
      for (const mod of userLearning.ai_recommendation) {
        console.log("ai_recommendation - stored unique_ModuleID:", mod.unique_ModuleID);
        if (mod.unique_ModuleID === uniqueModuleID) {
          existsInAIRec = true;
          break;
        }
      }
      console.log("existsInModules:", existsInModules, "existsInAIRec:", existsInAIRec);
      
      if (existsInModules) {
        return res.status(400).json({ message: "This module is already in your user learning preferences." });
      }
      if (existsInAIRec) {
        return res.status(400).json({ message: "This module is already in your AI recommended list." });
      }
    } else {
      console.log("No existing UserLearning record for section:", section_name);
      userLearning = new UserLearning({
        user_id,
        theme_id,
        section_id,
        modules: [],
        ai_recommendation: []
      });
    }
    
    // Determine the order for the new module based on existing modules
    const newModuleOrder = userLearning.modules.length + 1;
    
    // Add the new module along with the order property
    userLearning.modules.push({
      module_id: moduleDoc._id,
      unique_ModuleID: uniqueModuleID,
      module_name: modName,
      completed: false,
      order: newModuleOrder
    });
    
    await userLearning.save();
    console.log("Module added to UserLearning for section:", section_name);
    
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

    // Retrieve the UserLearning record for this user and the module's section.
    let userLearning = await UserLearning.findOne({ user_id, section_id: moduleDoc.section_id._id });
    if (!userLearning) {
      // No learning record means the module isn't stored.
      return res.status(200).json({ exists: false, message: "Module does not exist in your learning preferences." });
    }

    // Check if the module exists in either the user-preferred modules or AI-recommended modules arrays.
    const existsInModules = userLearning.modules.some(
      mod => mod.unique_ModuleID === moduleDoc.unique_ModuleID
    );
    const existsInAIRec = userLearning.ai_recommendation.some(
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

    const userLearning = await UserLearning.find({ user_id })
      .populate("theme_id", "name")
      .populate("section_id", "name")
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

    if (!userLearning.length) {
      return res
        .status(404)
        .json({ message: "No learning progress found for this user" });
    }

    let totalModuleCount = 0;
    let totalAiRecommendationCount = 0;

    // Group sections so that modules are nested directly inside each section object.
    const aiRecommendationsBySection = {};
    const userPreferenceBySection = {};

    userLearning.forEach(learning => {
      // Extract section details from the learning record.
      const section = learning.section_id
        ? { id: learning.section_id._id, name: learning.section_id.name }
        : { id: "unknown", name: "Unknown Section" };
      const sectionId = section.id.toString();

      // Process AI recommendations.
      learning.ai_recommendation.forEach(rec => {
        const moduleObj = {
          id: rec.module_id ? rec.module_id._id : null,
          name: rec.module_id ? rec.module_id.name : rec.module_name || "Unknown Module",
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

        if (!aiRecommendationsBySection[sectionId]) {
          // Create the section object and directly nest modules inside it.
          aiRecommendationsBySection[sectionId] = { ...section, modules: [] };
        }
        aiRecommendationsBySection[sectionId].modules.push(moduleObj);
        totalAiRecommendationCount++;
      });

      // Process user preference modules.
      learning.modules.forEach(mod => {
        const moduleObj = {
          id: mod.module_id ? mod.module_id._id : null,
          name: mod.module_id ? mod.module_id.name : mod.module_name || "Unknown Module",
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

        if (!userPreferenceBySection[sectionId]) {
          // Create the section object and nest modules inside it.
          userPreferenceBySection[sectionId] = { ...section, modules: [] };
        }
        userPreferenceBySection[sectionId].modules.push(moduleObj);
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

    // Retrieve all learning progress for the user with the necessary population.
    const userLearning = await UserLearning.find({ user_id })
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

    if (!userLearning.length) {
      return res.status(404).json({ message: "No learning progress found for this user" });
    }

    // Create a flat list of modules.
    let allModules = [];

    userLearning.forEach(learning => {
      // Process regular modules.
      if (learning.modules && learning.modules.length) {
        learning.modules.forEach(mod => {
          const moduleObj = {
            id: mod.module_id ? mod.module_id._id : null,
            name: mod.module_id ? mod.module_id.name : mod.module_name || "Unknown Module",
            completed: mod.completed,
            video: mod.module_id && mod.module_id.video
              ? {
                  channelName: mod.module_id.video.channel_name,
                  publish_date: mod.module_id.video.publish_date,
                  likes_count: mod.module_id.video.likes_count,
                  views_count: mod.module_id.video.views_count
                }
              : {}
          };
          allModules.push(moduleObj);
        });
      }
      // Process AI recommendation modules.
      if (learning.ai_recommendation && learning.ai_recommendation.length) {
        learning.ai_recommendation.forEach(rec => {
          const moduleObj = {
            id: rec.module_id ? rec.module_id._id : null,
            name: rec.module_id ? rec.module_id.name : rec.module_name || "Unknown Module",
            completed: rec.completed,
            video: rec.module_id && rec.module_id.video
              ? {
                  channelName: rec.module_id.video.channel_name,
                  publish_date: rec.module_id.video.publish_date,
                  likes_count: rec.module_id.video.likes_count,
                  views_count: rec.module_id.video.views_count
                }
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

module.exports = {
  addUserLearningByModule,
  addUserLearningByUniqueModule,
  checkUserLearningModule,
  getUserLearningProgress,
  updateUserLearningProgress,
  removeUserLearningModule,
  getAllLearningModules
};
