// controllers/skillController.js
const Skill = require("../Models/Skill");
const axios = require('axios');
const Video = require('../Models/Video');

async function createSkill(req, res) {
  try {
    const { skill_section, skill_Name, skill_description } = req.body;
    if (!skill_section || !skill_Name || !skill_description) {
      return res.status(400).json({ msg: "Please provide all required fields" });
    }
    const newSkill = new Skill({ skill_section, skill_Name, skill_description });
    const savedSkill = await newSkill.save();
    res.status(201).json(savedSkill);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getAllSkills(req, res) {
  try {
    const skills = await Skill.find();
    res.status(200).json(skills);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getSkillById(req, res) {
  try {
    const skill = await Skill.findById(req.params.id);
    if (!skill) {
      return res.status(404).json({ msg: "Skill not found" });
    }
    res.status(200).json(skill);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function deleteSkill(req, res) {
  try {
    const deletedSkill = await Skill.findByIdAndDelete(req.params.id);
    if (!deletedSkill) {
      return res.status(404).json({ msg: "Skill not found" });
    }
    res.status(200).json({ msg: "Skill deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
const storeSkills = async (req, res) => {
  const { video_id } = req.params;  
  if (!video_id) {
    return res.status(400).json({ message: "video_id is required" });
  }

  try {
    const response = await axios.post(
      "http://35.180.225.153/v2/match_skills/",
      { video_id },
      {
        headers: {
          'Content-Type': 'application/json',
          'accept': 'application/json'
        }
      }
    );

    let skillsArray;
    if (typeof response.data === 'string') {
      // Updated regex to handle both plain numbers and np.float32 numbers
      const tupleRegex = /\('([^']*)',\s*'([^']*)',\s*(?:np\.float32\()?([\d\.]+)(?:\))?\)/g;
      const jsonString = response.data.replace(tupleRegex, '["$1", "$2", $3]');
      try {
        skillsArray = JSON.parse(jsonString);
      } catch (err) {
        console.error("JSON parse error:", err);
        return res.status(400).json({ message: "Failed to parse skills data from external API", error: err.message });
      }
    } else if (Array.isArray(response.data)) {
      skillsArray = response.data;
    } else if (response.data && Array.isArray(response.data.skills)) {
      skillsArray = response.data.skills;
    } else {
      console.error("Unexpected response format:", response.data);
      return res.status(400).json({ message: "Invalid Skills data format from external API" });
    }

    let skillIds = [];

    for (const skill of skillsArray) {
      const [uniqueSkill_id, skill_description] = skill; 

      let skill_theme = "";
      let skill_Name = "";
      if (uniqueSkill_id.startsWith("S100")) {
        if (skill_description.toLowerCase().includes("language")) {
          skill_theme = "Natural Language Processing";
          skill_Name = "Language Understanding";
        } else {
          skill_theme = "Content Generation";
          skill_Name = "Content Generation";
        }
      } else if (uniqueSkill_id.startsWith("S300")) {
        skill_theme = "Software Development";
        skill_Name = "Code Generation";
      } else {
        skill_theme = "General";
        skill_Name = "General Skill";
      }
      let existingSkill = await Skill.findOne({ uniqueSkill_id });
      if (existingSkill) {
        skillIds.push(existingSkill._id);
      } else {
        const newSkill = new Skill({
          uniqueSkill_id,
          skill_theme,
          skill_Name,
          skill_description
        });
        const savedSkill = await newSkill.save();
        skillIds.push(savedSkill._id);
      }
    }
    if (skillIds.length > 3) {
      skillIds = skillIds.slice(0, 3);
    }

    const video = await Video.findOne({ youtubeVideo_id: video_id });
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }
    video.learnedSkills = skillIds;
    await video.save();

    res.status(200).json({
      message: "Skills stored successfully and linked to video",
      skills: skillIds,
      count: skillIds.length
    });
  } catch (error) {
    console.error("Error storing skills:", error);
    if (error.response && error.response.data) {
      return res.status(error.response.status).json({
        message: "Failed to store skills",
        error: error.response.data
      });
    }
    res.status(500).json({
      message: "Failed to store skills",
      error: error.message
    });
  }
};


  const updateVideoSkills = async (req, res) => {
    try {
      const { video_url, skills } = req.body;

      // Validate the request payload
      if (!video_url || !skills || !Array.isArray(skills)) {
        return res.status(400).json({ message: "video_url and skills array are required." });
      }

      const skillIds = [];
      const missingSkills = [];

      // For each provided skill, find it by the skill_Name field
      for (let skillName of skills) {
        skillName = skillName.trim();
        const skillDoc = await Skill.findOne({ skill_Name: skillName });
        if (!skillDoc) {
          missingSkills.push(skillName);
        } else {
          skillIds.push(skillDoc._id);
        }
      }

      // If any skills are missing, return an error
      if (missingSkills.length > 0) {
        return res.status(404).json({ message: "Some skills were not found.", missingSkills });
      }

      // Overwrite the learnedSkills array in the Video document with the new skills
      const updatedVideo = await Video.findOneAndUpdate(
        { video_url },
        { learnedSkills: skillIds },
        { new: true }
      );

      if (!updatedVideo) {
        return res.status(404).json({ message: "Video not found with the provided video_url." });
      }

      res.json({
        message: "Learned skills updated successfully.",
        video: updatedVideo,
      });
    } catch (error) {
      console.error("Error updating learned skills:", error);
      res.status(500).json({ error: "Server error updating learned skills." });
    }
  };

module.exports = {
  createSkill,
  getAllSkills,
  getSkillById,
  deleteSkill,
  storeSkills,
  updateVideoSkills
};
