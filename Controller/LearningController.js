const mongoose = require("mongoose");
const UserLearning = require("../Models/Learning");
const Section = require("../Models/Section");
const Module = require("../Models/Module");
const UserProgress = require("../Models/userProgress");

const addUserLearningByModule = async (req, res) => {
  try {
    console.log("=============== STARTING MODULE ADDITION ===============");
    const user_id = req.user.id;
    const { module_id } = req.body;

    // Validate module_id
    if (!module_id || !mongoose.Types.ObjectId.isValid(module_id)) {
      console.log("Error: Invalid module ID provided");
      return res.status(400).json({ message: "Invalid module ID provided." });
    }

    // Find the module and populate its section and theme
    console.log(`Searching for module with ID: ${module_id}`);
    const moduleDoc = await Module.findById(module_id).populate({
      path: "section_id",
      populate: { path: "theme_id" }
    });

    if (!moduleDoc) {
      console.log(`Error: Module with ID ${module_id} not found`);
      return res.status(404).json({ message: "Module not found" });
    }
    if (!moduleDoc.section_id) {
      console.log("Error: Module doesn't have a section_id");
      return res.status(404).json({ message: "Section not found for this module" });
    }
    if (!moduleDoc.section_id.theme_id) {
      console.log("Error: Section doesn't have a theme_id");
      return res.status(404).json({ message: "Theme not found for this section" });
    }

    const section_id = moduleDoc.section_id._id;
    const section_name = moduleDoc.section_id.name;
    const modName = moduleDoc.name;
    const uniqueModuleID = moduleDoc.unique_ModuleID;
    const theme_id = moduleDoc.section_id.theme_id._id;
    const theme_name = moduleDoc.section_id.theme_id.name;

    console.log("------------------ MODULE DETAILS ------------------");
    console.log("Section ID:", section_id);
    console.log("Section Name:", section_name);
    console.log("Module Name:", modName);
    console.log("Unique Module ID:", uniqueModuleID);
    console.log("Theme ID:", theme_id);
    console.log("Theme Name:", theme_name);

    // Find (or create) the consolidated UserLearning document for the user.
    console.log(`Fetching UserLearning document for user_id: ${user_id}`);
    let userLearning = await UserLearning.findOne({ user_id });
    if (!userLearning) {
      console.log("UserLearning document not found, creating a new one");
      userLearning = new UserLearning({ user_id, sections: [] });
      await userLearning.save();
      console.log("Created new UserLearning document with empty sections array");
    } else {
      console.log("UserLearning document found, checking existing sections");
    }

    // Check if this module already exists in ANY section before proceeding
    console.log("------------------ CHECKING FOR DUPLICATES ACROSS ALL SECTIONS ------------------");
    let moduleExists = false;
    
    if (userLearning.sections && userLearning.sections.length > 0) {
      for (const section of userLearning.sections) {
        // Check in modules array
        if (section.modules && section.modules.some(mod => 
          (mod.module_id && mod.module_id.toString() === moduleDoc._id.toString()) ||
          (mod.unique_ModuleID && uniqueModuleID && mod.unique_ModuleID.toString() === uniqueModuleID.toString())
        )) {
          moduleExists = true;
          console.log(`Module already exists in section ${section.section_id}`);
          break;
        }
        
        // Check in ai_recommendation array
        if (section.ai_recommendation && section.ai_recommendation.some(rec => 
          (rec.module_id && rec.module_id.toString() === moduleDoc._id.toString()) ||
          (rec.unique_ModuleID && uniqueModuleID && rec.unique_ModuleID.toString() === uniqueModuleID.toString())
        )) {
          moduleExists = true;
          console.log(`Module already exists in ai_recommendation for section ${section.section_id}`);
          break;
        }
      }
    }
    
    if (moduleExists) {
      console.log("Module already exists in user's learning preferences");
      return res.status(400).json({ message: "This module is already in your learning list." });
    }
    
    console.log("No duplicates found across any sections, proceeding with module addition");

    // Find the index of the section entry matching section_id.
    const sectionIndex = userLearning.sections.findIndex(sec =>
      sec.section_id && sec.section_id.toString() === section_id.toString()
    );

    // Prepare the section entry
    if (sectionIndex === -1) {
      console.log("No matching section found, creating new section entry");
      // Create a new section with modules array ready for the new module
      const newSection = {
        section_id,
        theme_id,
        modules: [], // Initialize empty modules array
        ai_recommendation: []
      };
      userLearning.sections.push(newSection);
      userLearning.markModified('sections');
      console.log(`Created new section entry at index ${userLearning.sections.length - 1}`);
    } else {
      console.log(`Using existing section at index ${sectionIndex}`);
    }
    
    // Re-find the section index to ensure we're working with the updated array
    const currentSectionIndex = userLearning.sections.findIndex(sec =>
      sec.section_id && sec.section_id.toString() === section_id.toString()
    );
    
    if (currentSectionIndex === -1) {
      console.log("Error: Failed to find or create section entry");
      return res.status(500).json({ message: "Failed to create section entry" });
    }
    
    // Get direct reference to the current section
    const currentSection = userLearning.sections[currentSectionIndex];
    
    // Initialize arrays if needed
    if (!currentSection.modules) {
      currentSection.modules = [];
      userLearning.markModified(`sections.${currentSectionIndex}.modules`);
    }
    
    if (!currentSection.ai_recommendation) {
      currentSection.ai_recommendation = [];
      userLearning.markModified(`sections.${currentSectionIndex}.ai_recommendation`);
    }

    // Double-check this specific section for duplicates, just to be safe
    console.log("------------------ CHECKING FOR DUPLICATES IN TARGET SECTION ------------------");
    const moduleAlreadyAdded =
      currentSection.modules.some(m => 
        (m.module_id && m.module_id.toString() === moduleDoc._id.toString()) ||
        (m.unique_ModuleID && uniqueModuleID && m.unique_ModuleID.toString() === uniqueModuleID.toString())
      ) ||
      currentSection.ai_recommendation.some(m => 
        (m.module_id && m.module_id.toString() === moduleDoc._id.toString()) ||
        (m.unique_ModuleID && uniqueModuleID && m.unique_ModuleID.toString() === uniqueModuleID.toString())
      );

    if (moduleAlreadyAdded) {
      console.log("Module already exists in target section");
      return res.status(400).json({ message: "This module is already in your learning list." });
    }
    
    console.log("No duplicates found in target section, proceeding with module addition");

    // Determine the order for the new module based on existing user-preferred modules.
    const newModuleOrder = currentSection.modules.length + 1;

    // Create the new module object
    const newModule = {
      order: newModuleOrder,
      module_id: moduleDoc._id,
      unique_ModuleID: uniqueModuleID,
      module_name: modName,
      completed: false,
    };
    
    console.log(`Adding new module to sections[${currentSectionIndex}].modules:`);
    console.log(JSON.stringify(newModule, null, 2));

    // Add the new module directly to the array in the document
    userLearning.sections[currentSectionIndex].modules.push(newModule);
    
    // Mark both the specific modules array and the entire sections array as modified
    userLearning.markModified(`sections.${currentSectionIndex}.modules`);
    userLearning.markModified('sections');

    console.log("------------------ SAVING CHANGES ------------------");
    console.log("Saving changes to UserLearning document");
    await userLearning.save({ validateModifiedOnly: true });
    console.log("Module added to UserLearning for section:", section_name);

    // Update user progress
    console.log("------------------ UPDATING USER PROGRESS ------------------");
    let userProgress = await UserProgress.findOne({ user_id });
    if (!userProgress) {
      console.log("UserProgress document not found, creating a new one");
      userProgress = new UserProgress({
        user_id,
        section_progress: [],
        completed_modules: [],
        theme_progress: []
      });
    } else {
      console.log("Found existing UserProgress document");
    }
    
    // Update section progress if not already tracked
    console.log(`Checking if section ${section_id} is already tracked in progress`);
    const sectionExists = userProgress.section_progress && userProgress.section_progress.some(
      sec => sec.section_id && sec.section_id.toString() === section_id.toString()
    );
    
    if (!sectionExists) {
      console.log(`Section ${section_name} not found in progress, adding it`);
      if (!userProgress.section_progress) {
        userProgress.section_progress = [];
      }
      userProgress.section_progress.push({
        section_id,
        status: "in_progress",
        completion_percentage: 0,
        started_at: new Date()
      });
      userProgress.markModified('section_progress');
    } else {
      console.log(`Section ${section_name} already exists in progress`);
    }
    
    // Update theme progress if not already tracked
    console.log(`Checking if theme ${theme_id} is already tracked in progress`);
    const themeExists = userProgress.theme_progress && userProgress.theme_progress.some(
      theme => theme.theme_id && theme.theme_id.toString() === theme_id.toString()
    );
    
    if (!themeExists) {
      console.log(`Theme ${theme_name} not found in progress, adding it`);
      if (!userProgress.theme_progress) {
        userProgress.theme_progress = [];
      }
      userProgress.theme_progress.push({
        theme_id,
        status: "in_progress",
        completion_percentage: 0,
        started_at: new Date()
      });
      userProgress.markModified('theme_progress');
    } else {
      console.log(`Theme ${theme_name} already exists in progress`);
    }

    console.log("Saving UserProgress document");
    await userProgress.save({ validateModifiedOnly: true });
    console.log("UserProgress updated successfully");

    console.log("=============== MODULE ADDITION COMPLETE ===============");
    res.status(201).json({
      message: "Module added successfully",
      data: {
        theme: theme_name,
        section: section_name,
        module: modName,
      }
    });
  } catch (error) {
    console.error("=============== ERROR IN MODULE ADDITION ===============");
    console.error("Error adding module to learning:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};





const addUserLearningByUniqueModule = async (req, res) => {
  try {
    console.log("=============== STARTING MODULE ADDITION ===============");
    const user_id = req.user.id;
    const { module_id } = req.body; // Here module_id is the unique module identifier

    console.log(`Request received for user_id: ${user_id}, module_id: ${module_id}`);

    if (!module_id) {
      console.log("Error: Module ID is missing from request");
      return res.status(400).json({ message: "Module ID is required." });
    }

    // Find the module by its unique_ModuleID and populate its section and theme.
    console.log(`Searching for module with unique_ModuleID: ${module_id}`);
    const moduleDoc = await Module.findOne({ unique_ModuleID: module_id }).populate({
      path: "section_id",
      populate: { path: "theme_id" }
    });
    if (!moduleDoc) {
      console.log(`Error: Module with unique_ModuleID ${module_id} not found`);
      return res.status(404).json({ message: "Module not found" });
    }
    if (!moduleDoc.section_id) {
      console.log("Error: Module doesn't have a section_id");
      return res.status(404).json({ message: "Section not found for this module" });
    }
    if (!moduleDoc.section_id.theme_id) {
      console.log("Error: Section doesn't have a theme_id");
      return res.status(404).json({ message: "Theme not found for this section" });
    }

    const section_id = moduleDoc.section_id._id;
    const section_name = moduleDoc.section_id.name;
    const modName = moduleDoc.name;
    const uniqueModuleID = moduleDoc.unique_ModuleID.toString();
    const theme_id = moduleDoc.section_id.theme_id._id;
    const theme_name = moduleDoc.section_id.theme_id.name;

    console.log("------------------ MODULE DETAILS ------------------");
    console.log(`Section ID: ${section_id}`);
    console.log(`Section Name: ${section_name}`);
    console.log(`Module Name: ${modName}`);
    console.log(`Unique Module ID: ${uniqueModuleID}`);
    console.log(`Theme ID: ${theme_id}`);
    console.log(`Theme Name: ${theme_name}`);

    // Fetch (or create) the UserLearning document for the user.
    console.log(`Fetching UserLearning document for user_id: ${user_id}`);
    let userLearning = await UserLearning.findOne({ user_id });
    if (!userLearning) {
      console.log("UserLearning document not found, creating a new one");
      userLearning = new UserLearning({ user_id, sections: [] });
      await userLearning.save();
      console.log("Created new UserLearning document with empty sections array");
    } else {
      console.log("UserLearning document found, checking existing sections");
    }

    // Ensure the sections array exists.
    if (!userLearning.sections) {
      console.log("Initializing missing sections array");
      userLearning.sections = [];
    }

    // Check if this module already exists in ANY section before proceeding
    console.log("------------------ CHECKING FOR DUPLICATES ACROSS ALL SECTIONS ------------------");
    let moduleExists = false;
    
    for (const section of userLearning.sections) {
      // Check in modules array
      if (section.modules && section.modules.some(mod => 
        mod.unique_ModuleID && mod.unique_ModuleID.toString() === uniqueModuleID
      )) {
        moduleExists = true;
        console.log(`Module with uniqueModuleID ${uniqueModuleID} already exists in section ${section.section_id}`);
        break;
      }
      
      // Check in ai_recommendation array
      if (section.ai_recommendation && section.ai_recommendation.some(rec => 
        rec.unique_ModuleID && rec.unique_ModuleID.toString() === uniqueModuleID
      )) {
        moduleExists = true;
        console.log(`Module with uniqueModuleID ${uniqueModuleID} already exists in ai_recommendation for section ${section.section_id}`);
        break;
      }
    }
    
    if (moduleExists) {
      return res.status(400).json({ message: "This module is already in your learning preferences." });
    }
    
    console.log("No duplicates found across any sections, proceeding with module addition");

    // Find the index of the section entry matching section_id.
    let sectionIndex = userLearning.sections.findIndex(sec =>
      sec.section_id && sec.section_id.toString() === section_id.toString()
    );

    // Prepare the section entry
    let sectionEntry;
    if (sectionIndex === -1) {
      console.log("No matching section found, creating new section entry");
      // Create a new section with modules array ready for the new module
      sectionEntry = {
        section_id: section_id,
        theme_id: theme_id,
        modules: [], // Initialize an empty modules array
        ai_recommendation: []
      };
      userLearning.sections.push(sectionEntry);
      sectionIndex = userLearning.sections.length - 1;
      console.log(`Created new section entry at index ${sectionIndex}`);
      
      // Mark the entire sections array as modified to ensure it's saved
      userLearning.markModified('sections');
    } else {
      sectionEntry = userLearning.sections[sectionIndex];
      console.log(`Using existing section at index ${sectionIndex}`);
    }
    
    // Ensure the section is properly referenced in the userLearning document
    // This ensures we're working with the actual section in the array
    sectionEntry = userLearning.sections[sectionIndex];

    // Double-check this specific section for duplicates, just to be safe
    console.log("------------------ CHECKING FOR DUPLICATES IN TARGET SECTION ------------------");
    console.log(`Checking if module with uniqueModuleID ${uniqueModuleID} already exists in section ${sectionEntry.section_id}`);
    
    // Initialize the modules array if it doesn't exist
    if (!sectionEntry.modules) {
      console.log("Initializing missing modules array");
      sectionEntry.modules = [];
      userLearning.markModified(`sections.${sectionIndex}.modules`);
    }
    
    const existsInModules = sectionEntry.modules.some(mod =>
      mod.unique_ModuleID && mod.unique_ModuleID.toString() === uniqueModuleID
    );
    
    // Initialize the ai_recommendation array if it doesn't exist
    if (!sectionEntry.ai_recommendation) {
      sectionEntry.ai_recommendation = [];
      userLearning.markModified(`sections.${sectionIndex}.ai_recommendation`);
    }
    
    const existsInAIRec = sectionEntry.ai_recommendation.some(rec =>
      rec.unique_ModuleID && rec.unique_ModuleID.toString() === uniqueModuleID
    );
    
    if (existsInModules || existsInAIRec) {
      console.log(`Module with uniqueModuleID ${uniqueModuleID} already exists.`);
      return res.status(400).json({ message: "This module is already in your learning preferences." });
    }
    console.log("No duplicates found in target section, proceeding with module addition");

    // Determine the order for the new module.
    const moduleOrder = sectionEntry.modules.length + 1;
    const newModule = {
      module_id: moduleDoc._id,
      unique_ModuleID: uniqueModuleID,
      module_name: modName,
      completed: false,
      order: moduleOrder
    };

    console.log(`Adding new module to sections[${sectionIndex}].modules`);
    console.log(JSON.stringify(newModule, null, 2));
    
    // Add the module to the section's modules array
    userLearning.sections[sectionIndex].modules.push(newModule);
    
    // Mark both the specific modules array and the entire sections array as modified
    userLearning.markModified(`sections.${sectionIndex}.modules`);
    userLearning.markModified('sections');

    console.log("------------------ SAVING CHANGES ------------------");
    console.log("Saving changes to UserLearning document");
    
    // Save with an option to ensure the update is applied
    await userLearning.save({ validateModifiedOnly: true });
    
    console.log("UserLearning document saved successfully");

    // Update user progress.
    console.log("------------------ UPDATING USER PROGRESS ------------------");
    let userProgress = await UserProgress.findOne({ user_id });
    if (!userProgress) {
      console.log("UserProgress document not found, creating a new one");
      userProgress = new UserProgress({
        user_id,
        section_progress: [],
        completed_modules: [],
        theme_progress: []
      });
    } else {
      console.log("Found existing UserProgress document");
    }

    // Update section progress if not already tracked.
    console.log(`Checking if section ${section_id} is already tracked in progress`);
    const sectionExists = userProgress.section_progress.some(
      sec => sec.section_id && sec.section_id.toString() === section_id.toString()
    );
    if (!sectionExists) {
      console.log(`Section ${section_name} not found in progress, adding it`);
      userProgress.section_progress.push({
        section_id,
        status: "in_progress",
        completion_percentage: 0,
        started_at: new Date()
      });
      userProgress.markModified('section_progress');
    } else {
      console.log(`Section ${section_name} already exists in progress`);
    }

    // Update theme progress if not already tracked.
    console.log(`Checking if theme ${theme_id} is already tracked in progress`);
    const themeExists = userProgress.theme_progress.some(
      theme => theme.theme_id && theme.theme_id.toString() === theme_id.toString()
    );
    if (!themeExists) {
      console.log(`Theme ${theme_name} not found in progress, adding it`);
      userProgress.theme_progress.push({
        theme_id,
        status: "in_progress",
        completion_percentage: 0,
        started_at: new Date()
      });
      userProgress.markModified('theme_progress');
    } else {
      console.log(`Theme ${theme_name} already exists in progress`);
    }

    console.log("Saving UserProgress document");
    await userProgress.save();
    console.log("UserProgress updated successfully");

    console.log("=============== MODULE ADDITION COMPLETE ===============");
    res.status(201).json({
      message: "Module added successfully",
      data: {
        theme: theme_name,
        section: section_name,
        module: modName,
      }
    });
  } catch (error) {
    console.error("=============== ERROR IN MODULE ADDITION ===============");
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



// const getUserLearningProgress = async (req, res) => {
//   try {
//     const user_id = req.user.id;

//     // Since we now have a consolidated UserLearning document per user,
//     // we use findOne instead of find.
//     const userLearning = await UserLearning.findOne({ user_id })
//       .populate({
//         path: "sections.section_id",
//         select: "name"
//       })
//       .populate({
//         path: "sections.theme_id",
//         select: "name"
//       })
//       .populate({
//         path: "sections.modules.module_id",
//         select: "name video",
//         populate: {
//           path: "video",
//           select: "channel_name"
//         }
//       })
//       .populate({
//         path: "sections.ai_recommendation.module_id",
//         select: "name video",
//         populate: {
//           path: "video",
//           select: "channel_name"
//         }
//       });

//     if (!userLearning) {
//       return res.status(404).json({ message: "No learning progress found for this user" });
//     }

//     let totalModuleCount = 0;
//     let totalAiRecommendationCount = 0;
//     const aiRecommendationsBySection = {};
//     const userPreferenceBySection = {};

//     // Iterate over each section in the consolidated document.
//     userLearning.sections.forEach(section => {
//       // Extract section details from the populated section_id.
//       const sec = section.section_id
//         ? { id: section.section_id._id, name: section.section_id.name }
//         : { id: "unknown", name: "Unknown Section" };
//       const secId = sec.id.toString();

//       // Process AI recommendation modules for this section.
//       section.ai_recommendation.forEach(rec => {
//         const moduleObj = {
//           id: rec.module_id ? rec.module_id._id : null,
//           name: rec.module_id ? rec.module_id.name : rec.module_name || "Unknown Module",
//           completed: rec.completed,
//           video: rec.module_id && rec.module_id.video
//             ? { channelName: rec.module_id.video.channel_name }
//             : {},
//           aiModuleTitle: rec.ai_module_title || null,
//           relevanceStatement: rec.relevance_statement || null
//         };

//         if (!aiRecommendationsBySection[secId]) {
//           aiRecommendationsBySection[secId] = { ...sec, modules: [] };
//         }
//         aiRecommendationsBySection[secId].modules.push(moduleObj);
//         totalAiRecommendationCount++;
//       });

//       // Process user-preferred modules for this section.
//       section.modules.forEach(mod => {
//         const moduleObj = {
//           id: mod.module_id ? mod.module_id._id : null,
//           name: mod.module_id ? mod.module_id.name : mod.module_name || "Unknown Module",
//           completed: mod.completed,
//           video: mod.module_id && mod.module_id.video
//             ? { channelName: mod.module_id.video.channel_name }
//             : {},
//           aiModuleTitle: mod.ai_module_title || null,
//           relevanceStatement: mod.relevance_statement || null
//         };

//         if (!userPreferenceBySection[secId]) {
//           userPreferenceBySection[secId] = { ...sec, modules: [] };
//         }
//         userPreferenceBySection[secId].modules.push(moduleObj);
//         totalModuleCount++;
//       });
//     });

//     const formattedProgress = {
//       totalAiRecommendationCount,
//       totalModuleCount,
//       aiRecommendations: Object.values(aiRecommendationsBySection),
//       userPreferenceModules: Object.values(userPreferenceBySection)
//     };

//     return res.status(200).json(formattedProgress);
//   } catch (error) {
//     console.error("Error getting learning progress:", error);
//     return res.status(500).json({ message: "Internal Server Error", error: error.message });
//   }
// };

const getUserLearningProgress = async (req, res) => {
  try {
    const user_id = req.user.id;
    console.log(`Fetching learning modules for user: ${user_id}`);
    
    // Get the user's learning data with populated references
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
          select: "channel_name channelName"
        }
      })
      .populate({
        path: "sections.ai_recommendation.module_id",
        select: "name video",
        populate: {
          path: "video",
          select: "channel_name channelName"
        }
      });

    if (!userLearning) {
      console.log("No learning modules found for user");
      return res.status(200).json({
        aiRecommendations: [],
        userPreferenceModules: [],
        totalAiRecommendationCount: 0,
        totalModuleCount: 0
      });
    }

    console.log("Found user learning document, processing data...");
    
    // Group data by section for user preference modules
    const userPreferenceBySection = {};
    // Group data by section for AI recommendations
    const aiRecommendationsBySection = {};
    
    // Process the sections array
    if (userLearning.sections && userLearning.sections.length > 0) {
      console.log(`Processing ${userLearning.sections.length} sections`);
      
      userLearning.sections.forEach((section, sectionIndex) => {
        // Get section details
        const sectionName = section.section_id && section.section_id.name ? 
                            section.section_id.name : 
                            `Section ${sectionIndex + 1}`;
        
        const sectionId = section.section_id ? section.section_id._id.toString() : `section_${sectionIndex}`;
        console.log(`Processing section ${sectionIndex}: ${sectionName} (ID: ${sectionId})`);
        
        // Process user modules
        if (section.modules && section.modules.length > 0) {
          console.log(`Processing ${section.modules.length} user modules in section ${sectionName}`);
          
          // Initialize section in userPreferenceBySection if not exists
          if (!userPreferenceBySection[sectionId]) {
            userPreferenceBySection[sectionId] = {
              id: section.section_id ? section.section_id._id : `section_id_${sectionIndex}`,
              name: sectionName,
              modules: []
            };
          }
          
          // Add each module to the section
          section.modules.forEach((mod, moduleIndex) => {
            // Get module details
            const moduleName = mod.module_id && mod.module_id.name ? mod.module_id.name : mod.module_name || `Module ${moduleIndex + 1}`;
            console.log(`Processing user module ${moduleIndex}: ${moduleName}`);
            
            // Get video channel name if available
            let channelName = "Unknown";
            if (mod.module_id && mod.module_id.video) {
              channelName = mod.module_id.video.channel_name || mod.module_id.video.channelName || "Unknown";
            }
            
            // Create the module object in the format expected by the frontend
            const moduleObj = {
              id: mod.module_id ? mod.module_id._id : null,
              unique_ModuleID: mod.unique_ModuleID,
              name: moduleName,
              completed: mod.completed || false,
              video: { channelName }
            };
            
            userPreferenceBySection[sectionId].modules.push(moduleObj);
          });
        }
        
        // Process AI recommendations
        if (section.ai_recommendation && section.ai_recommendation.length > 0) {
          console.log(`Processing ${section.ai_recommendation.length} AI recommendations in section ${sectionName}`);
          
          // Initialize section in aiRecommendationsBySection if not exists
          if (!aiRecommendationsBySection[sectionId]) {
            aiRecommendationsBySection[sectionId] = {
              id: section.section_id ? section.section_id._id : `section_id_${sectionIndex}`,
              name: sectionName,
              modules: []
            };
          }
          
          // Add each AI recommendation to the section
          section.ai_recommendation.forEach((rec, recIndex) => {
            // Get module details
            const moduleName = rec.module_id && rec.module_id.name ? rec.module_id.name : rec.module_name || `Recommendation ${recIndex + 1}`;
            console.log(`Processing AI recommendation ${recIndex}: ${moduleName}`);
            
            // Get video channel name if available
            let channelName = "Unknown";
            if (rec.module_id && rec.module_id.video) {
              channelName = rec.module_id.video.channel_name || rec.module_id.video.channelName || "Unknown";
            }
            
            // Create the module object in the format expected by the frontend
            const moduleObj = {
              id: rec.module_id ? rec.module_id._id : null,
              name: moduleName,
              completed: rec.completed || false,
              video: { channelName },
              aiModuleTitle: rec.ai_module_title || moduleName,
              relevanceStatement: rec.relevance_statement || ""
            };
            
            aiRecommendationsBySection[sectionId].modules.push(moduleObj);
          });
        }
      });
    } else {
      console.log("No sections found in user learning document");
    }
    
    // Convert the section maps to arrays
    const userPreferenceModules = Object.values(userPreferenceBySection);
    const aiRecommendations = Object.values(aiRecommendationsBySection);
    
    // Calculate total counts
    const totalModuleCount = userPreferenceModules.reduce(
      (total, section) => total + section.modules.length, 0
    );
    
    const totalAiRecommendationCount = aiRecommendations.reduce(
      (total, section) => total + section.modules.length, 0
    );
    
    console.log(`Found ${totalModuleCount} user modules in ${userPreferenceModules.length} sections`);
    console.log(`Found ${totalAiRecommendationCount} AI recommendations in ${aiRecommendations.length} sections`);
    
    // Return the formatted data
    return res.status(200).json({
      totalAiRecommendationCount,
      totalModuleCount,
      aiRecommendations,
      userPreferenceModules
    });
  } catch (error) {
    console.error("Error fetching learning modules:", error);
    return res.status(500).json({ 
      message: "Error fetching learning modules", 
      error: error.message 
    });
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

    // Retrieve UserLearning documents for the user and populate nested modules.
    const userLearnings = await UserLearning.find({ user_id })
      .populate({
        path: "sections.modules.module_id",
        select: "name video",
        populate: {
          path: "video",
          select: "channel_name likes_count views_count publish_date"
        }
      })
      .populate({
        path: "sections.ai_recommendation.module_id",
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

    // Iterate over each learning record and check within each section.
    userLearnings.forEach(learning => {
      if (learning.sections && Array.isArray(learning.sections)) {
        learning.sections.forEach(section => {
          // Check the modules array
          if (section.modules && Array.isArray(section.modules)) {
            section.modules.forEach(mod => {
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
          }
          // If not found, check the ai_recommendation array.
          if (!foundModule && section.ai_recommendation && Array.isArray(section.ai_recommendation)) {
            section.ai_recommendation.forEach(rec => {
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
