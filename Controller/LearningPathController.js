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
      headers: { "Content-Type": "application/json", accept: "application/json" },
    });
    console.log("AI API response received:", apiRes.data);

    const { message: apiMessage, analysis: aiAnalysis, output_path } = apiRes.data;

    // 1) Process the nested structure in the API response
    let sections = [];
    
    // Check if the response has a nested modules structure with sections inside
    if (aiAnalysis && Array.isArray(aiAnalysis.modules) && aiAnalysis.modules.length > 0 && 
        aiAnalysis.modules[0].section_name && Array.isArray(aiAnalysis.modules[0].modules)) {
      // The API is returning a structure where modules contains section objects
      console.log("Detected nested sections inside modules array");
      sections = aiAnalysis.modules;
    } 
    // Fallback to other formats
    else if (Array.isArray(aiAnalysis?.sections)) {
      sections = aiAnalysis.sections;
    } else if (Array.isArray(aiAnalysis?.modules)) {
      sections = [{
        section_name: apiMessage || "Custom Learning Path",
        modules: aiAnalysis.modules
      }];
    } else if (Array.isArray(aiAnalysis)) {
      sections = aiAnalysis;
    } else if (typeof aiAnalysis === "string") {
      // strip out ``` fences
      let str = aiAnalysis.trim()
        .replace(/^```json\s*/, "")
        .replace(/```$/, "");
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed.sections)) {
        sections = parsed.sections;
      } else if (Array.isArray(parsed.modules) && parsed.modules.length > 0 && 
                parsed.modules[0].section_name && Array.isArray(parsed.modules[0].modules)) {
        // Handle nested structure in string JSON
        sections = parsed.modules;
      } else if (Array.isArray(parsed.modules)) {
        sections = [{
          section_name: apiMessage || "Custom Learning Path",
          modules: parsed.modules
        }];
      } else if (Array.isArray(parsed)) {
        sections = parsed;
      }
    }

    if (!sections.length) {
      return res.status(500).json({
        success: false,
        message: "AI returned no sections or modules for the learning path",
      });
    }

    // 2) Log the raw sections structure before mapping
    console.log("Raw sections structure:", JSON.stringify(sections, null, 2));
    
    // 3) Map each module object into the exact keys your schema expects
    // Ensure that all required fields are present and properly formatted
    sections = sections.map(sec => {
      console.log(`Processing section: ${sec.section_name}`);
      return {
        section_name: sec.section_name || "Untitled Section",
        modules: (sec.modules || []).map((raw, index) => {
          console.log(`Processing module at index ${index}:`, raw);
          // Ensure all required fields have values, using fallbacks if necessary
          return {
            order: raw.order || index + 1, // Use index + 1 if order is missing
            module_id: raw.module_id || raw.moduleId || raw.moduleID || raw.id || `module-${index + 1}`,
            module_title: raw.module_title || raw.moduleTitle || raw.title || raw.name || `Module ${index + 1}`,
            relevance_statement: raw.relevance_statement || raw.relevanceStatement || raw.relevance || 
              raw.description || "This module is relevant to your learning path."
          };
        })
      };
    });

    // 4) Log the mapped sections to verify they match the schema
    console.log("Mapped sections:", JSON.stringify(sections, null, 2));

    // 5) Upsert into LearningPath
    let lp = await LearningPath.findOne({ user_id: payload.user_id });
    if (lp) {
      lp.payload = payload;
      lp.analysis = sections;
      lp.output_path = output_path;
      await lp.save();
      console.log("Updated existing LearningPath for user:", payload.user_id);
    } else {
      lp = await LearningPath.create({
        user_id: payload.user_id,
        payload,
        analysis: sections,
        output_path
      });
      console.log("Created new LearningPath for user:", payload.user_id);
    }

    // 6) Consolidate into UserLearning…
    let ul = await UserLearning.findOne({ user_id: payload.user_id });
    if (!ul) {
      ul = new UserLearning({ user_id: payload.user_id, sections: [] });
    }

    for (const sec of sections) {
      console.log("Processing section for UserLearning:", sec.section_name);
      const sorted = sec.modules.sort((a, b) => a.order - b.order);
      const recs = [];
      let sectionId = null;

      for (const m of sorted) {
        const modDoc = await Module.findOne({ unique_ModuleID: m.module_id });
        if (!modDoc) {
          console.warn("Module not found:", m.module_id);
          continue;
        }
        sectionId ??= modDoc.section_id;
        recs.push({
          order: m.order,
          module_id: modDoc._id,
          unique_ModuleID: modDoc.unique_ModuleID,
          module_name: modDoc.name,
          ai_module_title: m.module_title,
          relevance_statement: m.relevance_statement,
          completed: false
        });
      }

      // pull theme_id out of Section
      let themeId = null;
      if (sectionId) {
        const secDoc = await Section.findById(sectionId);
        themeId = secDoc?.theme_id || null;
      }

      const existing = ul.sections.find(s => s.section_id?.toString() === sectionId?.toString());
      if (existing) {
        existing.ai_recommendation = recs;
      } else if (sectionId) {
        ul.sections.push({
          section_id: sectionId,
          theme_id: themeId,
          ai_recommendation: recs,
          modules: []
        });
      }
    }
    await ul.save();
    console.log("UserLearning updated for user:", payload.user_id);

    // 7) Return
    return res.status(200).json({
      success: true,
      message: apiMessage,
      data: lp,
      output_path
    });
    
  } catch (err) {
    console.error("Error generating learning path:", err.response?.data || err.message || err);
    return res.status(err.response?.status || 500).json({
      success: false,
      message: err.response?.data?.message || "Failed to generate learning path",
      error: err.message
    });
  }
};