const mongoose = require("mongoose");
const UserLearning = require("../Models/Learning");
const Section = require("../Models/Section");
const Module = require("../Models/Module");
const Video = require("../Models/Video");
const UserProgress = require("../Models/userProgress");
const Theme = require("../Models/Theme");

const addUserLearningByModule = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { module_id } = req.body;

    // Validate module ID
    if (!module_id || !mongoose.Types.ObjectId.isValid(module_id)) {
      return res.status(400).json({ message: "Invalid module ID provided." });
    }

    // Find the module with its section
    const module = await Module.findById(module_id).populate({
      path: "section_id",
      populate: { path: "theme_id" }
    });

    if (!module) {
      return res.status(404).json({ message: "Module not found" });
    }

    // Check if section_id exists
    if (!module.section_id) {
      return res.status(404).json({ message: "Section not found for this module" });
    }

    const section_id = module.section_id._id;
    const section_name = module.section_id.name;
    const module_name = module.name;
    
    // Check if theme_id exists in the section
    if (!module.section_id.theme_id) {
      return res.status(404).json({ message: "Theme not found for this section" });
    }
    
    const theme_id = module.section_id.theme_id._id;
    const theme_name = module.section_id.theme_id.name;

    // Get all videos for the module
    const videos = await Video.find({ module_id: module._id });
    const formattedVideos = videos.map(video => ({
      video_id: video._id,
      video_name: video.title || video.name,
      watch_percentage: 0,
      quiz_completed: false,
      quiz_score: 0
    }));

    // Check if user has already added this module
    let existingLearning = await UserLearning.findOne({
      user_id,
      "modules.module_id": module_id
    });

    if (existingLearning) {
      return res.status(400).json({ message: "This module is already in your learning list." });
    }

    // Check if the section exists in user's learning
    let userLearning = await UserLearning.findOne({
      user_id,
      section_id
    });

    // If the section doesn't exist in user's learning, create a new entry
    if (!userLearning) {
      userLearning = new UserLearning({
        user_id,
        theme_id,
        section_id,
        modules: []
      });
    }

    // Add the module to user's learning
    userLearning.modules.push({
      module_id,
      module_name,
      completed: false,
      videos: formattedVideos
    });

    await userLearning.save();

    // Update user progress
    let userProgress = await UserProgress.findOne({ user_id });
    if (!userProgress) {
      userProgress = new UserProgress({
        user_id,
        section_progress: [],
        completed_modules: []
      });
    }

    // Check if section already exists in progress
    const existingSection = userProgress.section_progress.find(
      sec => sec.section_id.toString() === section_id.toString()
    );

    if (!existingSection) {
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
        module: module_name,
        videos: formattedVideos
      }
    });
  } catch (error) {
    console.error("Error adding module to learning:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
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
        select: "name"
      })
      .populate({
        path: "modules.videos.video_id",
        select: "title name duration"
      });

    if (!userLearning.length) {
      return res.status(404).json({ message: "No learning progress found for this user" });
    }

    // Format the response to include theme, section, module and video details
    const formattedResponse = userLearning.map(learning => {
      return {
        _id: learning._id,
        theme: learning.theme_id ? {
          id: learning.theme_id._id,
          name: learning.theme_id.name
        } : { id: null, name: "Unknown Theme" },
        section: learning.section_id ? {
          id: learning.section_id._id,
          name: learning.section_id.name
        } : { id: null, name: "Unknown Section" },
        modules: learning.modules.map(module => {
          if (!module.module_id) {
            return {
              id: null,
              name: module.module_name || "Unknown Module",
              completed: module.completed,
              videos: module.videos ? module.videos.map(video => {
              return {
                id: video.video_id ? video.video_id._id : null,
                name: video.video_id ? (video.video_id.title || video.video_id.name) : video.video_name,
                watch_percentage: video.watch_percentage,
                quiz_completed: video.quiz_completed,
                quiz_score: video.quiz_score,
                completed_at: video.completed_at,
                duration: video.video_id ? video.video_id.duration : null
              };
            }) : []
          };
          }
          
          return {
            id: module.module_id._id,
            name: module.module_id.name || module.module_name || "Unknown Module",
            completed: module.completed,
            videos: module.videos ? module.videos.map(video => {
              return {
                id: video.video_id ? video.video_id._id : null,
                name: video.video_id ? (video.video_id.title || video.video_id.name) : video.video_name || "Unknown Video",
                watch_percentage: video.watch_percentage,
                quiz_completed: video.quiz_completed,
                quiz_score: video.quiz_score,
                completed_at: video.completed_at,
                duration: video.video_id ? video.video_id.duration : null
              };
            }) : []
          };
        })
      };
    });

    res.status(200).json(formattedResponse);
  } catch (error) {
    console.error("Error getting learning progress:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

const getAllLearningModules = async (req, res) => {
  try {
    const user_id = req.user.id;

    // Find all user learning records
    const learningRecords = await UserLearning.find({ user_id })
      .populate("theme_id", "name")
      .populate("section_id", "name")
      .populate({
        path: "modules.module_id",
        select: "name"
      });

    if (!learningRecords.length) {
      return res.status(404).json({ message: "No modules added for learning." });
    }

    // Format the response to include all modules
    const learningModules = [];
    
          learningRecords.forEach(record => {
      if (!record.theme_id || !record.section_id) {
        return; // Skip records with missing theme or section
      }
      
      record.modules.forEach(module => {
        if (!module.module_id) {
          return; // Skip modules with missing module_id
        }
        
        learningModules.push({
          theme_id: record.theme_id._id,
          theme_name: record.theme_id.name,
          section_id: record.section_id._id,
          section_name: record.section_id.name,
          module_id: module.module_id._id,
          module_name: module.module_id.name || module.module_name || "Unknown Module",
          completed: module.completed,
          video_count: module.videos ? module.videos.length : 0,
          completed_videos: module.videos ? 
            module.videos.filter(v => v.watch_percentage === 100).length : 0
        });
      });
    });

    res.status(200).json({ learningModules });
  } catch (error) {
    console.error("Error retrieving learning modules:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

const updateUserLearningProgress = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { module_id, video_id, watch_percentage, quiz_completed, quiz_score } = req.body;

    // Validate required fields
    if (!module_id || !video_id) {
      return res.status(400).json({ message: "Module ID and Video ID are required" });
    }

    // Find the user learning record that contains the module
    let userLearning = await UserLearning.findOne({
      user_id,
      "modules.module_id": module_id
    });

    if (!userLearning) {
      return res.status(404).json({ message: "User learning record not found for this module" });
    }

    // Find the module in the modules array
    const moduleIndex = userLearning.modules.findIndex(
      mod => mod.module_id.toString() === module_id
    );

    if (moduleIndex === -1) {
      return res.status(404).json({ message: "Module not found in user learning" });
    }

    // Find the video in the videos array
    const videoIndex = userLearning.modules[moduleIndex].videos.findIndex(
      vid => vid.video_id.toString() === video_id
    );

    if (videoIndex === -1) {
      return res.status(404).json({ message: "Video not found in module" });
    }

    // Update the video progress
    if (watch_percentage !== undefined) {
      userLearning.modules[moduleIndex].videos[videoIndex].watch_percentage = watch_percentage;
    }
    
    if (quiz_completed !== undefined) {
      userLearning.modules[moduleIndex].videos[videoIndex].quiz_completed = quiz_completed;
    }
    
    if (quiz_score !== undefined) {
      userLearning.modules[moduleIndex].videos[videoIndex].quiz_score = quiz_score;
    }

    // Set completed_at if watch_percentage is 100%
    if (watch_percentage === 100) {
      userLearning.modules[moduleIndex].videos[videoIndex].completed_at = new Date();
    }

    // Check if all videos are completed and update module completion status
    const allVideosCompleted = userLearning.modules[moduleIndex].videos.every(
      video => video.watch_percentage === 100
    );

    if (allVideosCompleted) {
      userLearning.modules[moduleIndex].completed = true;

      // Update user progress to add to completed modules
      let userProgress = await UserProgress.findOne({ user_id });
      
      if (userProgress) {
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
      }

      // Check if all modules in the section are completed
      const allModulesInSectionCompleted = userLearning.modules.every(
        mod => mod.completed
      );

      if (allModulesInSectionCompleted) {
        // Update section status to completed in UserProgress
        let userProgress = await UserProgress.findOne({ user_id });
        
        if (userProgress) {
          const sectionProgressIndex = userProgress.section_progress.findIndex(
            sec => sec.section_id.toString() === userLearning.section_id.toString()
          );

          if (sectionProgressIndex !== -1) {
            userProgress.section_progress[sectionProgressIndex].status = "completed";
            await userProgress.save();
          }
        }
      }
    }

    await userLearning.save();

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

    // Remove the module from the modules array
    userLearning.modules = userLearning.modules.filter(
      mod => mod.module_id.toString() !== module_id
    );

    // If no modules remain for this section, remove the entire learning record
    if (userLearning.modules.length === 0) {
      await UserLearning.deleteOne({ _id: userLearning._id });

      // Also update user progress to remove this section
      await UserProgress.updateOne(
        { user_id },
        { $pull: { section_progress: { section_id: userLearning.section_id } } }
      );

      return res.status(200).json({ message: "Module removed successfully. No modules remain in this section." });
    } else {
      // Save the updated learning record
      await userLearning.save();
    }

    // Remove the module from completed_modules in UserProgress if exists
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
  getUserLearningProgress,
  getAllLearningModules,
  updateUserLearningProgress,
  removeUserLearningModule,
};