const mongoose = require("mongoose");
const UserLearning = require("../Models/Learning");
const Section = require("../Models/Section");
const Module = require("../Models/Module");
const Video = require("../Models/Video");
const UserProgress = require("../Models/userProgress"); 



const addUserLearningBySection = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { section_id } = req.body;

    const section = await Section.findById(section_id).populate("theme_id");
    if (!section) {
      return res.status(404).json({ message: "Section not found" });
    }

    const theme_id = section.theme_id?._id;
    const theme_name = section.theme_id ? section.theme_id.name : "Unknown Theme";
    const section_name = section.name;

    if (!theme_id) {
      return res.status(400).json({ message: "Theme ID not found for the section." });
    }

    let userProgress = await UserProgress.findOne({ user_id });
    if (!userProgress) {
      userProgress = new UserProgress({
        user_id,
        section_progress: [],
        completed_modules: [],
      });
    }
    const existingSection = userProgress.section_progress.find(
      (sec) => sec.section_id.toString() === section_id
    );
    if (existingSection) {
      const msg = existingSection.status === "completed"
        ? "This section has already been completed."
        : "This section is already in progress.";
      return res.status(400).json({ message: msg });
    }
    const modules = await Module.find({ section_id });
    const formattedModules = modules.map((module) => ({
      module_id: module._id,
      module_name: module.name,
      completed: userProgress.completed_modules.some(
        (cm) => cm.module_id.toString() === module._id.toString()
      ),
    }));
    const userLearning = new UserLearning({
      user_id,
      theme_id,
      section_id,
      modules: formattedModules,
    });
    await userLearning.save();
    userProgress.section_progress.push({
      section_id: section._id,
      status: "in_progress",
    });
    await userProgress.save();
    res.status(201).json({
      message: "Section added successfully",
      data: {
        _id: userLearning._id,
        theme: theme_name,
        section: section_name,
        modules: formattedModules,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};


const getUserLearningProgress = async (req, res) => {
  try {
    const user_id = req.user.id; 

    const userLearning = await UserLearning.find({ user_id })
      .populate("theme_id", "name")
      .populate("section_id", "name")
      .populate("modules.module_id", "name")
    if (!userLearning.length) {
      return res.status(404).json({ message: "No learning progress found for this user" });
    }

    res.status(200).json(userLearning);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

const getAllLearningSections = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID provided." });
    }

    const userProgress = await UserProgress.findOne({ user_id: userId }).populate({
      path: "section_progress",
      populate: {
        path: "section_id",
        select: "name _id",
        populate: {
          path: "modules",
          select: "name _id video",
        }
      }
    });

    if (!userProgress || !userProgress.section_progress.length) {
      return res.status(404).json({ message: "No sections added for learning." });
    }

    const learningSections = userProgress.section_progress.map(sp => ({
      section_id: sp.section_id._id,
      section_name: sp.section_id.name,
      status: sp.status,
      modules: sp.section_id.modules.map(module => ({
        module_id: module._id,
        module_name: module.name,
      }))
    }));

    res.status(200).json({ learningSections });
  } catch (error) {
    console.error("Error retrieving learning sections:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};



const updateUserLearningProgress = async (req, res) => {
  try {
    const user_id = req.user.id; 
    const { section_id, module_id, video_id, watch_percentage, quiz_completed, quiz_score } = req.body;

    let userLearning = await UserLearning.findOne({ user_id, section_id });

    if (!userLearning) {
      return res.status(404).json({ message: "User learning record not found" });
    }

    userLearning.modules.forEach((module) => {
      if (module.module_id.toString() === module_id) {
        module.videos.forEach((video) => {
          if (video.video_id.toString() === video_id) {
            video.watch_percentage = watch_percentage;
            video.quiz_completed = quiz_completed;
            video.quiz_score = quiz_score;
            video.completed_at = new Date();
          }
        });

        if (module.videos.every((video) => video.watch_percentage === 100)) {
          module.completed = true;
        }
      }
    });

    await userLearning.save();

    res.status(200).json({ message: "Progress updated successfully", data: userLearning });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};


const removeUserLearningSection = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { section_id } = req.params;

    const userLearning = await UserLearning.findOneAndDelete({ user_id, section_id });

    if (!userLearning) {
      return res.status(404).json({ message: "Learning section not found" });
    }

    res.status(200).json({ message: "Section removed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};


module.exports = {
  addUserLearningBySection,
  getUserLearningProgress,
  getAllLearningSections,
  updateUserLearningProgress,
  removeUserLearningSection,
};