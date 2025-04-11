const User = require("../Models/User");
const Onboarding = require("../Models/Onboarding");

const createOnBoarding = async (req, res) => {
  try {
    const {
      current_role,
      industry,
      department,
      highest_education,
      role,
      company_Size,
      frequency_at_work,
      AI_level,
      goals,
      interests,
      challenge,
      preffered_learning_style,
      weekly_commitment,
      how_often,
    } = req.body;
    
    const user_id = req.user._id;

    if (interests && interests.length > 5) {
      return res.status(400).json({ message: "Interests cannot exceed 5 items." });
    }
    if (goals && goals.length > 3) {
      return res.status(400).json({ message: "Goals cannot exceed 3 items." });
    }

    const roleBoolean = !!role; 

    const existingOnboarding = await Onboarding.findOne({ user_id });
    if (existingOnboarding) {
      return res.status(400).json({ message: "Onboarding data already exists for this user." });
    }

    const newOnboarding = new Onboarding({
      user_id,
      current_role,
      industry,
      department,
      highest_education,
      role: roleBoolean,
      company_Size,
      frequency_at_work,
      AI_level,
      goals,
      interests,
      challenge,
      preffered_learning_style,
      weekly_commitment,
      how_often,
    });

    await newOnboarding.save();

    res.status(201).json({ 
      message: "Onboarding data saved successfully", 
      onboarding: newOnboarding 
    });
  } catch (error) {
    console.error("Error saving onboarding data:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};



const retrieveData = async (req, res) => {
    try {
      const user_id = req.user._id;
  
      const onboardingData = await Onboarding.findOne({ user_id })
        .populate("user_id", "username email");
  
      if (!onboardingData) {
        return res.status(404).json({ message: "Onboarding data not found" });
      }
  
      const data = onboardingData.toObject();
  
      data.username = data.user_id.username;
      data.email = data.user_id.email;
  
      res.status(200).json(data);
    } catch (error) {
      console.error("Error retrieving onboarding data:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  };
  
  const updateOnboarding = async (req, res) => {
    try {
      const user_id = req.user._id;
      let onboardingData = await Onboarding.findOne({ user_id });
      if (!onboardingData) {
        return res.status(404).json({ message: "Onboarding data not found" });
      }
      const {
        current_role,
        industry,
        department,
        highest_education,
        role,
        company_Size,
        frequency_at_work,
        AI_level,
        goals,
        interests,
        challenge,
        preffered_learning_style,
        weekly_commitment,
        how_often,
      } = req.body;
  
      if (interests && interests.length > 5) {
        return res.status(400).json({ message: "Interests cannot exceed 5 items." });
      }
      if (goals && goals.length > 3) {
        return res.status(400).json({ message: "Goals cannot exceed 3 items." });
      }
  
      if (current_role !== undefined) onboardingData.current_role = current_role;
      if (industry !== undefined) onboardingData.industry = industry;
      if (department !== undefined) onboardingData.department = department;
      if (highest_education !== undefined) onboardingData.highest_education = highest_education;
      if (role !== undefined) onboardingData.role = !!role; 
      if (company_Size !== undefined) onboardingData.company_Size = company_Size;
      if (frequency_at_work !== undefined) onboardingData.frequency_at_work = frequency_at_work;
      if (AI_level !== undefined) onboardingData.AI_level = AI_level;
      if (goals !== undefined) onboardingData.goals = goals;
      if (interests !== undefined) onboardingData.interests = interests;
      if (challenge !== undefined) onboardingData.challenge = challenge;
      if (preffered_learning_style !== undefined) onboardingData.preffered_learning_style = preffered_learning_style;
      if (weekly_commitment !== undefined) onboardingData.weekly_commitment = weekly_commitment;
      if (how_often !== undefined) onboardingData.how_often = how_often;
  
      await onboardingData.save();
  
      res.status(200).json({
        message: "Onboarding data updated successfully",
        onboarding: onboardingData
      });
    } catch (error) {
      console.error("Error updating onboarding data:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  };  

  const getAllUserProfiles = async (req, res) => {
    try {
      // Find all onboarding records and populate with user details
      const allOnboardingData = await Onboarding.find({})
        .populate("user_id", "username email");
  
      if (!allOnboardingData || allOnboardingData.length === 0) {
        return res.status(404).json({ message: "No user profiles found" });
      }
  
      // Transform the data to include username and email at the top level
      const profiles = allOnboardingData.map(profile => {
        const profileData = profile.toObject();
        
        return profileData;
      });
  
      res.status(200).json(profiles);
    } catch (error) {
      console.error("Error retrieving all user profiles:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  };

module.exports = { createOnBoarding, retrieveData, updateOnboarding, getAllUserProfiles};
