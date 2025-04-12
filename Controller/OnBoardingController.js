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
      .populate("user_id", "username email name");

    if (!onboardingData) {
      return res.status(404).json({ message: "Onboarding data not found" });
    }

    const data = onboardingData.toObject();
    data.username = data.user_id.username || data.user_id.name || "";
    data.email = data.user_id.email || "";

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
      // 1. Populate user_id with all possible name fields if your schema allows it.
      //    But if your DB schema has no "name" field in the user doc, omit it.
      const allOnboardingData = await Onboarding.find({})
        .populate("user_id", "username name email");
  
      if (!allOnboardingData || allOnboardingData.length === 0) {
        return res.status(404).json({ message: "No user profiles found" });
      }
  
      const profiles = allOnboardingData.map(profileDoc => {
        // Convert the Mongoose document to a plain object
        const profile = profileDoc.toObject();
  
        // Prepare a variable for username and email (or first name/last name if desired)
        let username = "";
        let email = "";
  
        // 2. If we have a local user doc, try to get username or name from there:
        if (profile.user_id) {
          username = profile.user_id.username 
            || profile.user_id.name 
            || "";
          email = profile.user_id.email 
            || "";
        }
  
        // 3. If username is still empty, check if there's a Google provider object:
        if (!username && profile.google) {
          // For Google, you might have firstName, lastName, givenName, familyName, etc.
          username = profile.google.givenName 
            || profile.google.firstName 
            || "";
          // Optionally, combine firstName + lastName
          // username = `${profile.google.firstName || ""} ${profile.google.lastName || ""}`.trim();
          email = email || profile.google.email || "";
        }
  
        // 4. If still empty, check if there's an Apple provider object:
        if (!username && profile.apple) {
          username = profile.apple.givenName
            || profile.apple.firstName
            || "";
          email = email || profile.apple.email || "";
        }
  
        // 5. Fall back to the existing top-level email if nothing else is set:
        email = email || profile.email || "";
  
        // 6. Assign these normalized fields back to the profile object you want to return
        profile.username = username;
        profile.email = email;
  
        return profile;
      });
  
      res.status(200).json(profiles);
    } catch (error) {
      console.error("Error retrieving all user profiles:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  };
  
  

module.exports = { createOnBoarding, retrieveData, updateOnboarding, getAllUserProfiles};
