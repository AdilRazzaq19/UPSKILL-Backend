const axios = require("axios");
const _ = require("lodash");
const LearningPath = require("../Models/LearningPath");
const Module = require("../Models/Module");
const UserLearning = require("../Models/Learning");
const Section = require("../Models/Section");

// Define the keys you want to compare in the payload
const KEYS_TO_COMPARE = [
  "user_role",
  "department",
  "industry",
  "ai_skill_level",
  "digital_fluency",
  "leadership_manager",
  "company_size",
];

exports.validateLearningPathPayload = (req, res, next) => {
  const {
    user_role,
    department,
    industry,
    ai_skill_level,
    digital_fluency,
    leadership_manager,
    company_size,
  } = req.body;

  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized. User token not found.",
    });
  }

  if (
    !user_role ||
    !department ||
    !industry ||
    !ai_skill_level ||
    !digital_fluency ||
    typeof leadership_manager !== "boolean" ||
    !company_size
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid payload. Please provide all required fields.",
    });
  }
  
  // Attach the user_id from the authenticated user to the payload
  req.body.user_id = req.user.id;
  next();
};

exports.checkExistingLearningPath = async (req, res, next) => {
  const { user_id } = req.body;
  try {
    const existingLP = await LearningPath.findOne({ user_id });
    if (existingLP) {
      // Convert stored payload to plain object if it is a Mongoose document
      let storedPayload = existingLP.payload;
      if (storedPayload && storedPayload.toObject) {
        storedPayload = storedPayload.toObject();
      }
      
      // Compare only the relevant keys from the payload
      const requestSubset = _.pick(req.body, KEYS_TO_COMPARE);
      const storedSubset = _.pick(storedPayload, KEYS_TO_COMPARE);

      console.log("Request payload subset:", JSON.stringify(requestSubset, null, 2));
      console.log("Stored payload subset:", JSON.stringify(storedSubset, null, 2));

      if (_.isEqual(requestSubset, storedSubset)) {
        console.log("Payload unchanged, returning existing learning path for user:", user_id);
        return res.status(200).json({
          success: true,
          message: "Learning path data retrieved from the database.",
          data: existingLP,
        });
      } else {
        console.log("Payload changed. Overwriting existing learning path for user:", user_id);
        next();
      }
    } else {
      next();
    }
  } catch (err) {
    console.error("Error checking existing learning path:", err);
    return res.status(500).json({
      success: false,
      message: "Error checking existing learning path.",
    });
  }
};

// exports.generateLearningPath = async (req, res) => {
//   try {
//     const payload = req.body;
//     console.log("Generating learning path with payload:", payload);

//     const aiApiUrl = "http://35.180.225.153/v2/generate_learning_path";
//     const response = await axios.post(aiApiUrl, payload, {
//       headers: {
//         "Content-Type": "application/json",
//         accept: "application/json",
//       },
//     });
//     console.log("AI API response received");

//     // Parse analysis data
//     let { analysis } = response.data;
//     if (typeof analysis === "string") {
//       try {
//         analysis = JSON.parse(analysis);
//         console.log("Parsed analysis JSON successfully");
//       } catch (parseError) {
//         console.error("Error parsing analysis:", parseError);
//         throw new Error("Invalid analysis JSON format from AI API");
//       }
//     }

//     // Update the existing LearningPath document if it exists; otherwise, create a new one.
//     let existingLP = await LearningPath.findOne({ user_id: payload.user_id });
//     if (existingLP) {
//       existingLP.payload = req.body; // Overwrite with the new payload
//       existingLP.analysis = analysis;
//       await existingLP.save();
//       console.log("Updated existing LearningPath document for user:", payload.user_id);
//     } else {
//       existingLP = new LearningPath({
//         user_id: payload.user_id,
//         payload: req.body,
//         analysis,
//       });
//       await existingLP.save();
//       console.log("Saved new LearningPath document for user:", payload.user_id);
//     }

//     // Process each section in the analysis for UserLearning updates
//     for (const section of analysis) {
//       console.log("Processing section:", section.section_name);
      
//       // Sort modules by order to preserve the specified sequence.
//       const sortedModules = section.modules.sort((a, b) => a.order - b.order);
//       console.log("Sorted modules for section:", sortedModules);
      
//       const userLearningModules = [];
//       let sectionId = null;
  
//       // Process every module in the section
//       for (const mod of sortedModules) {
//         // Look up the module using its unique module identifier
//         const moduleDoc = await Module.findOne({ unique_ModuleID: mod.module_id });
//         if (moduleDoc) {
//           // Set sectionId from the first module found in the section
//           if (!sectionId) {
//             sectionId = moduleDoc.section_id;
//           }
//           // Push module details including the unique_ModuleID field
//           userLearningModules.push({
//             module_id: moduleDoc._id,
//             unique_ModuleID: moduleDoc.unique_ModuleID,
//             module_name: moduleDoc.name,
//             completed: false,
//           });
//         } else {
//           console.log("Module not found for unique_ModuleID:", mod.module_id);
//         }
//       }
      
//       console.log("Final ordered modules for section", section.section_name, ":", userLearningModules);
      
//       // Retrieve theme_id from the Section document using sectionId
//       let themeId = null;
//       if (sectionId) {
//         const sectionDoc = await Section.findById(sectionId);
//         if (sectionDoc && sectionDoc.theme_id) {
//           themeId = sectionDoc.theme_id;
//         } else {
//           console.log("No theme_id found in Section for section_id:", sectionId);
//         }
//       }
      
//       // Update or create a UserLearning record for this section.
//       // Overwrite only the ai_recommendation field while leaving the modules array intact.
//       if (userLearningModules.length > 0 && sectionId) {
//         let existingUserLearning = await UserLearning.findOne({
//           user_id: payload.user_id,
//           theme_id: themeId, // use the themeId obtained from Section
//           section_id: sectionId
//         });
//         if (existingUserLearning) {
//           // Overwrite only ai_recommendation, preserving the existing modules array
//           existingUserLearning.ai_recommendation = userLearningModules;
//           await existingUserLearning.save();
//           console.log("Updated UserLearning document (ai_recommendation) for section_id:", sectionId);
//         } else {
//           const newUserLearning = new UserLearning({
//             user_id: payload.user_id,
//             theme_id: themeId,
//             section_id: sectionId,
//             ai_recommendation: userLearningModules,
//             modules: [] // Initially empty for user-preferred modules
//           });
//           await newUserLearning.save();
//           console.log("Created new UserLearning document (ai_recommendation) for section_id:", sectionId);
//         }
//       } else {
//         console.log("No valid modules or sectionId found for section:", section.section_name);
//       }
//     }
  
//     res.status(response.status).json(existingLP);
//   } catch (err) {
//     console.error("Error generating learning path:", err.response?.data || err.message);
//     res.status(err.response?.status || 500).json({
//       success: false,
//       message: err.response?.data?.message || "Failed to generate learning path",
//     });
//   }
// };

// exports.generateLearningPath = async (req, res) => {
//   try {
//     const payload = req.body;
//     console.log("Generating learning path with payload:", payload);

//     const aiApiUrl = "http://15.237.7.12/v2/generate_learning_path";
//     const response = await axios.post(aiApiUrl, payload, {
//       headers: {
//         "Content-Type": "application/json",
//         accept: "application/json",
//       },
//     });
//     console.log("AI API response received");

//     // Parse analysis data
//     let { analysis } = response.data;
//     if (typeof analysis === "string") {
//       try {
//         analysis = JSON.parse(analysis);
//         console.log("Parsed analysis JSON successfully");
//       } catch (parseError) {
//         console.error("Error parsing analysis:", parseError);
//         throw new Error("Invalid analysis JSON format from AI API");
//       }
//     }

//     // Update or create the LearningPath document
//     let existingLP = await LearningPath.findOne({ user_id: payload.user_id });
//     if (existingLP) {
//       existingLP.payload = req.body; // Overwrite with the new payload
//       existingLP.analysis = analysis;
//       await existingLP.save();
//       console.log("Updated existing LearningPath document for user:", payload.user_id);
//     } else {
//       existingLP = new LearningPath({
//         user_id: payload.user_id,
//         payload: req.body,
//         analysis,
//       });
//       await existingLP.save();
//       console.log("Saved new LearningPath document for user:", payload.user_id);
//     }

//     // Process each section in the analysis for UserLearning updates
//     for (const section of analysis) {
//       console.log("Processing section:", section.section_name);

//       // Sort modules by order to preserve the specified sequence.
//       const sortedModules = section.modules.sort((a, b) => a.order - b.order);
//       console.log("Sorted modules for section:", sortedModules);

//       const userLearningModules = [];
//       let sectionId = null;

//       // Process every module in the section
//       for (let i = 0; i < sortedModules.length; i++) {
//         const mod = sortedModules[i];
//         // Look up the module using its unique module identifier
//         const moduleDoc = await Module.findOne({ unique_ModuleID: mod.module_id });
//         if (moduleDoc) {
//           // Set sectionId from the first module found in the section
//           if (!sectionId) {
//             sectionId = moduleDoc.section_id;
//           }
//           // Build the module learning object using your schema:
//           userLearningModules.push({
//             order: mod.order || (i + 1), // Use provided order or fallback to index+1
//             module_id: moduleDoc._id, // ObjectId reference from Module document
//             unique_ModuleID: moduleDoc.unique_ModuleID, // Unique module identifier (string)
//             module_name: moduleDoc.name, // Original module title from the DB
//             ai_module_title: mod.module_title || "", // AI recommended module title
//             relevance_statement: mod.relevance_statement || "", // AI relevance statement
//             completed: false,
//           });
//         } else {
//           console.log("Module not found for unique_ModuleID:", mod.module_id);
//         }
//       }

//       console.log("Final ordered modules for section", section.section_name, ":", userLearningModules);

//       // Retrieve theme_id from the Section document using sectionId
//       let themeId = null;
//       if (sectionId) {
//         const sectionDoc = await Section.findById(sectionId);
//         if (sectionDoc && sectionDoc.theme_id) {
//           themeId = sectionDoc.theme_id;
//         } else {
//           console.log("No theme_id found in Section for section_id:", sectionId);
//         }
//       }

//       // Update or create a UserLearning record for this section.
//       if (userLearningModules.length > 0 && sectionId) {
//         let existingUserLearning = await UserLearning.findOne({
//           user_id: payload.user_id,
//           theme_id: themeId,
//           section_id: sectionId,
//         });
//         if (existingUserLearning) {
//           // Overwrite only the ai_recommendation field while preserving user-preferred modules.
//           existingUserLearning.ai_recommendation = userLearningModules;
//           await existingUserLearning.save();
//           console.log("Updated UserLearning document (ai_recommendation) for section_id:", sectionId);
//         } else {
//           const newUserLearning = new UserLearning({
//             user_id: payload.user_id,
//             theme_id: themeId,
//             section_id: sectionId,
//             ai_recommendation: userLearningModules,
//             modules: [] // Initially empty for user-preferred modules
//           });
//           await newUserLearning.save();
//           console.log("Created new UserLearning document (ai_recommendation) for section_id:", sectionId);
//         }
//       } else {
//         console.log("No valid modules or sectionId found for section:", section.section_name);
//       }
//     }

//     // Return the updated LearningPath document, including AI recommendation details
//     res.status(response.status).json(existingLP);
//   } catch (err) {
//     console.error("Error generating learning path:", err.response ? err.response.data : err.message);
//     res.status(err.response?.status || 500).json({
//       success: false,
//       message: err.response?.data?.message || "Failed to generate learning path",
//     });
//   }
// };


exports.generateLearningPath = async (req, res) => {
  try {
    const payload = req.body;
    console.log("Generating learning path with payload:", payload);

    const aiApiUrl = "http://15.237.7.12/v2/generate_learning_path";
    const response = await axios.post(aiApiUrl, payload, {
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
      },
    });
    console.log("AI API response received");

    // Parse analysis data
    let { analysis } = response.data;
    if (typeof analysis === "string") {
      // Remove markdown code block markers if present
      analysis = analysis.trim();
      if (analysis.startsWith("```json")) {
        analysis = analysis.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (analysis.startsWith("```")) {
        analysis = analysis.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }
      
      try {
        analysis = JSON.parse(analysis);
        console.log("Parsed analysis JSON successfully");
      } catch (parseError) {
        console.error("Error parsing analysis:", parseError);
        throw new Error("Invalid analysis JSON format from AI API");
      }
    }

    // Update or create the LearningPath document
    let existingLP = await LearningPath.findOne({ user_id: payload.user_id });
    if (existingLP) {
      existingLP.payload = req.body; // Overwrite with the new payload
      existingLP.analysis = analysis;
      await existingLP.save();
      console.log("Updated existing LearningPath document for user:", payload.user_id);
    } else {
      existingLP = new LearningPath({
        user_id: payload.user_id,
        payload: req.body,
        analysis,
      });
      await existingLP.save();
      console.log("Saved new LearningPath document for user:", payload.user_id);
    }

    // Process each section in the analysis for UserLearning updates
    for (const section of analysis) {
      console.log("Processing section:", section.section_name);

      // Sort modules by order to preserve the specified sequence.
      const sortedModules = section.modules.sort((a, b) => a.order - b.order);
      console.log("Sorted modules for section:", sortedModules);

      const userLearningModules = [];
      let sectionId = null;

      // Process every module in the section
      for (let i = 0; i < sortedModules.length; i++) {
        const mod = sortedModules[i];
        // Look up the module using its unique module identifier
        const moduleDoc = await Module.findOne({ unique_ModuleID: mod.module_id });
        if (moduleDoc) {
          // Set sectionId from the first module found in the section
          if (!sectionId) {
            sectionId = moduleDoc.section_id;
          }
          // Build the module learning object using your schema:
          userLearningModules.push({
            order: mod.order || (i + 1), // Use provided order or fallback to index+1
            module_id: moduleDoc._id, // ObjectId reference from Module document
            unique_ModuleID: moduleDoc.unique_ModuleID, // Unique module identifier (string)
            module_name: moduleDoc.name, // Original module title from the DB
            ai_module_title: mod.module_title || "", // AI recommended module title
            relevance_statement: mod.relevance_statement || "", // AI relevance statement
            completed: false,
          });
        } else {
          console.log("Module not found for unique_ModuleID:", mod.module_id);
        }
      }

      console.log("Final ordered modules for section", section.section_name, ":", userLearningModules);

      // Retrieve theme_id from the Section document using sectionId
      let themeId = null;
      if (sectionId) {
        const sectionDoc = await Section.findById(sectionId);
        if (sectionDoc && sectionDoc.theme_id) {
          themeId = sectionDoc.theme_id;
        } else {
          console.log("No theme_id found in Section for section_id:", sectionId);
        }
      }

      // Update or create a UserLearning record for this section.
      if (userLearningModules.length > 0 && sectionId) {
        let existingUserLearning = await UserLearning.findOne({
          user_id: payload.user_id,
          theme_id: themeId,
          section_id: sectionId,
        });
        if (existingUserLearning) {
          // Overwrite only the ai_recommendation field while preserving user-preferred modules.
          existingUserLearning.ai_recommendation = userLearningModules;
          await existingUserLearning.save();
          console.log("Updated UserLearning document (ai_recommendation) for section_id:", sectionId);
        } else {
          const newUserLearning = new UserLearning({
            user_id: payload.user_id,
            theme_id: themeId,
            section_id: sectionId,
            ai_recommendation: userLearningModules,
            modules: [] // Initially empty for user-preferred modules
          });
          await newUserLearning.save();
          console.log("Created new UserLearning document (ai_recommendation) for section_id:", sectionId);
        }
      } else {
        console.log("No valid modules or sectionId found for section:", section.section_name);
      }
    }

    // Return the updated LearningPath document, including AI recommendation details
    res.status(response.status).json(existingLP);
  } catch (err) {
    console.error("Error generating learning path:", err.response ? err.response.data : err.message);
    res.status(err.response?.status || 500).json({
      success: false,
      message: err.response?.data?.message || "Failed to generate learning path",
    });
  }
};
