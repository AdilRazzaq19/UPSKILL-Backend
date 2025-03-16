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

    // Validate that a module ID is provided and that it's a valid ObjectId
    if (!module_id || !mongoose.Types.ObjectId.isValid(module_id)) {
      return res.status(400).json({ message: "Invalid module ID provided." });
    }

    // Find the module by its _id (not by a "module_id" field) and populate its section and theme
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

    // Log the details
      console.log("Section ID:", section_id);
      console.log("Section Name:", section_name);
      console.log("Module Name:", modName);
      console.log("Unique Module ID:", uniqueModuleID);
      console.log("Theme ID:", theme_id);
      console.log("Theme Name:", theme_name);

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

    let userLearning = await UserLearning.findOne({ user_id, section_id });
    if (!userLearning) {
      userLearning = new UserLearning({
        user_id,
        theme_id,
        section_id,
        modules: [],
        ai_recommendation: []
      });
    }

    // Add the module to the user-preferred modules array (including unique_ModuleID for schema compliance)
    userLearning.modules.push({
      module_id: moduleDoc._id,
      unique_ModuleID: uniqueModuleID,
      module_name: modName,
      completed: false,
      // videos: formattedVideos, // If you want to include videos, otherwise remove this line.
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
    userLearning.modules.push({
      module_id: moduleDoc._id,
      unique_ModuleID: uniqueModuleID,
      module_name: modName,
      completed: false,
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
          select: "channel_name" 
        }
      })
      .populate({
        path: "ai_recommendation.module_id",
        select: "name video",
        populate: {
          path: "video",
          select: "channel_name"
        }
      });

    if (!userLearning.length) {
      return res.status(404).json({ message: "No learning progress found for this user" });
    }

    let totalModuleCount = 0;
    let totalAiRecommendationCount = 0;
    const formattedProgress = userLearning.map(learning => {
      const moduleCount = learning.modules.length;
      const aiRecommendationCount = learning.ai_recommendation.length;
      totalModuleCount += moduleCount;
      totalAiRecommendationCount += aiRecommendationCount;

      return {
        _id: learning._id,
        theme: learning.theme_id
          ? { id: learning.theme_id._id, name: learning.theme_id.name }
          : { id: null, name: "Unknown Theme" },
        section: learning.section_id
          ? { id: learning.section_id._id, name: learning.section_id.name }
          : { id: null, name: "Unknown Section" },
        modules: learning.modules.map(mod => ({
          id: mod.module_id ? mod.module_id._id : null,
          name: mod.module_id ? mod.module_id.name : mod.module_name || "Unknown Module",
          completed: mod.completed,
          video: mod.module_id && mod.module_id.video
            ? {channelName: mod.module_id.video.channel_name }
            : {}
        })),
        ai_recommendation: learning.ai_recommendation.map(mod => ({
          id: mod.module_id ? mod.module_id._id : null,
          name: mod.module_id ? mod.module_id.name : mod.module_name || "Unknown Module",
          completed: mod.completed,
          video: mod.module_id && mod.module_id.video
            ? {channelName: mod.module_id.video.channel_name }
            : {}
        })),
        moduleCount,
        aiRecommendationCount
      };
    });

    return res.status(200).json({
      totalModuleCount,
      totalAiRecommendationCount,
      learningProgress: formattedProgress
    });
  } catch (error) {
    console.error("Error getting learning progress:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
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
  removeUserLearningModule
};
