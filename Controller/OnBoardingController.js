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
      .populate("user_id", "username email name authMethod google apple");
    
    if (!onboardingData) {
      return res.status(404).json({ message: "Onboarding data not found" });
    }
    
    const data = onboardingData.toObject();
    
    // Initialize these fields with empty strings
    let username = "";
    let email = "";
    
    // Check if the populated user_id is available before accessing its properties
    if (data.user_id) {
      // Always get the email from the user document
      email = data.user_id.email || "";
      const authMethod = data.user_id.authMethod;
      
      if (authMethod === "local") {
        // For local users, use the username if available; otherwise, fallback to name
        if (data.user_id.username && data.user_id.username.trim() !== "") {
          username = data.user_id.username;
        } else if (data.user_id.name && data.user_id.name.trim() !== "") {
          username = data.user_id.name;
        }
      } else if (authMethod === "google") {
        // For Google users, use google.userInfo
        if (data.user_id.google && data.user_id.google.userInfo) {
          const googleInfo = data.user_id.google.userInfo;
          if (googleInfo.name && googleInfo.name.trim() !== "") {
            username = googleInfo.name;
          } else {
            // Combine givenName and familyName as a fallback
            const given = googleInfo.givenName || "";
            const family = googleInfo.familyName || "";
            username = [given, family].filter(part => part.trim() !== "").join(" ");
          }
        }
      } else if (authMethod === "apple") {
        // For Apple users, try to extract a name from apple data
        if (data.user_id.apple) {
          const appleData = data.user_id.apple;
          if (appleData.userInfo && appleData.userInfo.name && appleData.userInfo.name.trim() !== "") {
            username = appleData.userInfo.name;
          } else if (appleData.fullName && appleData.fullName.givenName && appleData.fullName.givenName.trim() !== "") {
            const given = appleData.fullName.givenName;
            const family = appleData.fullName.familyName || "";
            username = [given, family].filter(part => part.trim() !== "").join(" ");
          }
        }
        // If still no username, derive it from the email
        if (!username && email) {
          const localPart = email.split("@")[0];
          username = localPart.replace(/[\._]/g, " ");
          username = username.charAt(0).toUpperCase() + username.slice(1);
        }
      } else {
        // Default fallback for any other auth method
        username = data.user_id.username || data.user_id.name || "";
      }
    }
    
    // Attach the normalized fields to the data object
    data.username = username;
    data.email = email;
    
    // Return the data with the same structure as before
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
    // Only allow admin access
    if (req.userRole !== "admin") {
      return res.status(403).json({ message: "Access denied: Admins only." });
    }
  
    try {
      // Include additional fields for social authentication.
      const allOnboardingData = await Onboarding.find({})
        .populate("user_id", "username name authMethod google apple email");
  
      if (!allOnboardingData || allOnboardingData.length === 0) {
        return res.status(404).json({ message: "No user profiles found" });
      }
  
      const profiles = allOnboardingData.map(doc => {
        const profile = doc.toObject();
  
        let username = "";
        let email = "";
  
        if (profile.user_id) {
          // Always get the email from the user document.
          email = profile.user_id.email || "";
          const authMethod = profile.user_id.authMethod;
  
          if (authMethod === "local") {
            // For local users, use the username if available; otherwise, fallback to name.
            if (profile.user_id.username && profile.user_id.username.trim() !== "") {
              username = profile.user_id.username;
            } else if (profile.user_id.name && profile.user_id.name.trim() !== "") {
              username = profile.user_id.name;
            }
          } else if (authMethod === "google") {
            // For Google users, use google.userInfo.
            if (profile.user_id.google && profile.user_id.google.userInfo) {
              const googleInfo = profile.user_id.google.userInfo;
              if (googleInfo.name && googleInfo.name.trim() !== "") {
                username = googleInfo.name;
              } else {
                // Combine givenName and familyName as a fallback.
                const given = googleInfo.givenName || "";
                const family = googleInfo.familyName || "";
                username = [given, family].filter(part => part.trim() !== "").join(" ");
              }
            }
          } else if (authMethod === "apple") {
            // For Apple users, try to extract a name from apple data.
            if (profile.user_id.apple) {
              const appleData = profile.user_id.apple;
              if (appleData.userInfo && appleData.userInfo.name && appleData.userInfo.name.trim() !== "") {
                username = appleData.userInfo.name;
              } else if (appleData.fullName && appleData.fullName.givenName && appleData.fullName.givenName.trim() !== "") {
                const given = appleData.fullName.givenName;
                const family = appleData.fullName.familyName || "";
                username = [given, family].filter(part => part.trim() !== "").join(" ");
              }
            }
            // If still no username, derive it from the email.
            if (!username && email) {
              const localPart = email.split("@")[0];
              username = localPart.replace(/[\._]/g, " ");
              username = username.charAt(0).toUpperCase() + username.slice(1);
            }
          }
        }
  
        // Attach normalized fields.
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
