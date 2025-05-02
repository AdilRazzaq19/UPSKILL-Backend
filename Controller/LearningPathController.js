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
  "interests"
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
    interests = [],
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
    !company_size||
    !interests
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

exports.generateLearningPath = async (req, res) => {
  try {
    const payload = req.body;
    console.log("Generating learning path with payload:", payload);

    const aiApiUrl = "http://15.237.7.12/v2/generate_learning_path";
    const apiRes = await axios.post(aiApiUrl, payload, {
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
      },
    });
    console.log("AI API response received:", apiRes.data);

    // Destructure the new response shape
    const { message: apiMessage, analysis: aiAnalysis, output_path } = apiRes.data;

    // Normalize to an array of section objects
    let sections = [];
    if (aiAnalysis && Array.isArray(aiAnalysis.sections)) {
      sections = aiAnalysis.sections;
    } else if (Array.isArray(aiAnalysis)) {
      sections = aiAnalysis;
    } else if (typeof aiAnalysis === "string") {
      let str = aiAnalysis.trim();
      if (str.startsWith("```json")) {
        str = str.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (str.startsWith("```")) {
        str = str.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }
      const parsed = JSON.parse(str);
      sections = Array.isArray(parsed.sections)
        ? parsed.sections
        : Array.isArray(parsed)
        ? parsed
        : [];
    }

    if (sections.length === 0) {
      return res.status(500).json({
        success: false,
        message: "AI returned no sections for the learning path",
      });
    }

    // Upsert LearningPath document
    let learningPath = await LearningPath.findOne({ user_id: payload.user_id });
    if (learningPath) {
      learningPath.payload     = payload;
      learningPath.analysis    = sections;       // <-- store array directly
      learningPath.output_path = output_path;    // <-- store path separately
      await learningPath.save();
      console.log("Updated existing LearningPath for user:", payload.user_id);
    } else {
      learningPath = await LearningPath.create({
        user_id:     payload.user_id,
        payload,
        analysis:    sections,       // <-- array
        output_path,                // <-- path
      });
      console.log("Created new LearningPath for user:", payload.user_id);
    }

    // Consolidate into UserLearning (unchanged) …
    let userLearning = await UserLearning.findOne({ user_id: payload.user_id });
    if (!userLearning) {
      userLearning = new UserLearning({ user_id: payload.user_id, sections: [] });
    }

    for (const section of sections) {
      console.log("Processing section:", section.section_name);

      // sort, lookup modules, build recommendations…
      const sortedModules = section.modules.sort((a, b) => a.order - b.order);
      const userLearningModules = [];
      let sectionId = null;

      for (let i = 0; i < sortedModules.length; i++) {
        const mod = sortedModules[i];
        const moduleDoc = await Module.findOne({ unique_ModuleID: mod.module_id });
        if (!moduleDoc) {
          console.log("Module not found for ID:", mod.module_id);
          continue;
        }
        if (!sectionId) sectionId = moduleDoc.section_id;

        userLearningModules.push({
          order:            mod.order || i + 1,
          module_id:        moduleDoc._id,
          unique_ModuleID:  moduleDoc.unique_ModuleID,
          module_name:      moduleDoc.name,
          ai_module_title:  mod.module_title || "",
          relevance_statement: mod.relevance_statement || "",
          completed:        false,
        });
      }

      // get theme_id from Section
      let themeId = null;
      if (sectionId) {
        const sectionDoc = await Section.findById(sectionId);
        if (sectionDoc) themeId = sectionDoc.theme_id;
      }

      // merge or add this section in userLearning
      const existing = userLearning.sections.find(
        s => s.section_id.toString() === sectionId?.toString()
      );
      if (existing) {
        existing.ai_recommendation = userLearningModules;
      } else {
        userLearning.sections.push({
          section_id:       sectionId,
          theme_id:         themeId,
          ai_recommendation: userLearningModules,
          modules:          [], // user‐selected modules
        });
      }
    }

    await userLearning.save();
    console.log("UserLearning updated for user:", payload.user_id);

    // Final response: include the AI's message, the stored doc, and the path
    res.status(200).json({
      success:     true,
      message:     apiMessage,
      data:        learningPath,
      output_path
    });

  } catch (err) {
    console.error("Error generating learning path:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      success: false,
      message: err.response?.data?.message || "Failed to generate learning path"
    });
  }
};


  