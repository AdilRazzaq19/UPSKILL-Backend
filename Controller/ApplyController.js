const axios = require("axios");
const Exercise = require("../Models/ApplyandOwnit");

/**
 * Converts Markdown content into a simplified JSON structure.
 * This function uses remark-parse to create an AST and then
 * extracts only the text content from headings, paragraphs, and lists.
 *
 * @param {string} markdownContent - The Markdown text to parse.
 * @returns {Promise<object>} - A simplified JSON representation.
 */
async function convertMarkdownToJson(markdownContent) {
  const { unified } = await import("unified");
  const remarkParse = (await import("remark-parse")).default;
  
  const processor = unified().use(remarkParse);
  const tree = processor.parse(markdownContent);
  
  const simpleJson = extractSimpleJson(tree);
  return simpleJson;
}

/**
 * Traverses the Markdown AST and extracts a simplified structure.
 * It looks for headings (levels 1-3), paragraphs, and lists,
 * then organizes the text into a JSON with a title and sections.
 *
 * @param {object} ast - The Markdown AST.
 * @returns {object} - A simplified JSON representation.
 */
function extractSimpleJson(ast) {
  const result = { title: "", sections: [] };
  let currentSection = null;
  let currentSubsection = null;
  
  if (!ast || !ast.children) {
    return result;
  }
  
  for (const node of ast.children) {
    if (node.type === "heading" && node.depth === 1) {
      // Main title
      result.title = extractText(node);
    } else if (node.type === "heading" && node.depth === 2) {
      // New section
      currentSection = { section_title: extractText(node), content: "", subsections: [] };
      result.sections.push(currentSection);
      currentSubsection = null;
    } else if (node.type === "heading" && node.depth === 3) {
      // New subsection within the current section
      currentSubsection = { subsection_title: extractText(node), content: "" };
      if (currentSection) {
        currentSection.subsections.push(currentSubsection);
      }
    } else if (node.type === "paragraph" || node.type === "list") {
      // Extract text from paragraphs or lists
      const text = extractText(node);
      if (currentSubsection) {
        currentSubsection.content += text + " ";
      } else if (currentSection) {
        currentSection.content += text + " ";
      }
    }
  }
  
  result.sections.forEach(section => {
    section.content = section.content.trim();
    section.subsections.forEach(sub => {
      sub.content = sub.content.trim();
    });
  });
  
  return result;
}

/**
 * Recursively extracts text content from a node.
 *
 * @param {object} node - An AST node.
 * @returns {string} - The concatenated text.
 */
function extractText(node) {
  if (node.type === "text") {
    return node.value;
  } else if (node.children && Array.isArray(node.children)) {
    return node.children.map(extractText).join(" ");
  }
  return "";
}

exports.validateExercisePayload = (req, res, next) => {
  const {
    video_id,
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
    !video_id ||
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
  req.body.user_id = req.user.id;
  next();
};

exports.checkExistingExercise = async (req, res, next) => {
  const { user_id, video_id } = req.body;
  try {
    const existingExercise = await Exercise.findOne({ user_id, video_id });
    if (existingExercise) {
      return res.status(200).json({
        success: true,
        message: "Exercise data retrieved from the database.",
        data: existingExercise.exerciseData,
      });
    }
    next();
  } catch (err) {
    console.error("Error checking existing exercise:", err);
    return res.status(500).json({
      success: false,
      message: "Error checking existing exercise.",
    });
  }
};

exports.generateExercise = async (req, res) => {
  try {
    const payload = req.body;
    const response = await axios.post(
      "http://15.237.7.12/v2/generate_exercise",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
        },
      }
    );

    let parsedContent;
    if (response.data.content) {
      parsedContent = await convertMarkdownToJson(response.data.content);
    } else {
      parsedContent = response.data;
    }

    const newExercise = new Exercise({
      user_id: payload.user_id,
      video_id: payload.video_id,
      exerciseData: parsedContent,
    });
    await newExercise.save();

    res.status(200).json({
      success: true,
      message: "Practical exercise generated successfully",
      data: {
        content: parsedContent,
      },
    });
  } catch (err) {
    console.error("Error generating exercise:", err.message);
    res.status(err.response?.status || 500).json({
      success: false,
      message:
        err.response?.data?.message || "Failed to generate exercise",
    });
  }
};
