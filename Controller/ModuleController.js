const Module = require("../Models/Module");
const Section = require("../Models/Section");
const FlashcardResponse = require("../Models/FlashCard");
const Theme = require("../Models/Theme");
const UserProgress = require("../Models/userProgress");
const VideoSkill = require("../Models/Video");

const createModule = async (req, res) => {
    try {
        const { unique_ModuleID,name, section_id, theme_id} = req.body;

        // Validate required fields
        if (!unique_ModuleID || !name || !section_id || !theme_id) {
            return res.status(400).json({ message: "Unique Module ID, Name, Section ID, and Theme ID are required." });
        }

        const existingModule = await Module.findOne({ unique_ModuleID });
        if (existingModule) {
          return res.status(400).json({ message: "A module with this unique_ModuleID already exists." });
        }        
        // Check if the section exists
        const sectionExists = await Section.findById(section_id);
        if (!sectionExists) {
            return res.status(404).json({ message: "Section not found." });
        }

        // Check if the theme exists
        const themeExists = await Theme.findById(theme_id);
        if (!themeExists) {
            return res.status(404).json({ message: "Theme not found." });
        }

        // Create a new module
        const newModule = new Module({
            unique_ModuleID,
            name,
            section_id,
            theme_id,
        });

        // Save the new module
        await newModule.save();

        // Optionally, add the module to the section's modules array
        sectionExists.modules.push(newModule._id);
        await sectionExists.save();

        res.status(201).json({
            message: "Module created successfully",
            module: newModule
        });
    } catch (error) {
        console.error("Error creating module:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};


  
  const getModules = async (req, res) => {
    try {
        const modules = await Module.find()
            .populate({
                path: "section_id",
                select: "name theme_id",
                populate: {
                    path: "theme_id", 
                    select: "name"    
                }
            })
            .populate({
                path: "video",
                select: "_id youtubeVideo_id video_url channel_name publish_date likes_count views_count"
            })
            .lean();

        // Extract all youtubeVideo_ids from the modules that have video details.
        const videoIds = modules
            .filter(mod => mod.video && mod.video.youtubeVideo_id)
            .map(mod => mod.video.youtubeVideo_id);

        const flashcards = await FlashcardResponse.find({
            video_id: { $in: videoIds },
            section: "introduction"
        }).lean();

        const flashcardMap = {};
        flashcards.forEach(fc => {
            flashcardMap[fc.video_id] = fc.content;
        });

        const extractFirstParagraph = (content) => {
            if (!content) return "";
            content = content.replace(/#\s*Topic Overview\s*/i, "");
            const paragraphs = content.split(/\n\s*\n/);
            for (let p of paragraphs) {
                const trimmed = p.trim();
                if (trimmed) {
                    return trimmed;
                }
            }
            return "";
        };

        modules.forEach(moduleObj => {
            if (moduleObj.video && moduleObj.video.youtubeVideo_id) {
                const fcContent = flashcardMap[moduleObj.video.youtubeVideo_id];
                moduleObj.introduction = fcContent ? extractFirstParagraph(fcContent) : null;
            } else {
                moduleObj.introduction = null;
            }
        });

        res.status(200).json(modules);
    } catch (error) {
      console.error("Error retrieving modules:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
};

const getModuleById = async (req, res) => {
    try {
        const { module_id } = req.params;
        
        if (!module_id) {
            return res.status(400).json({ error: "module_id is required." });
        }

        const moduleData = await Module.findById(module_id)
        .populate("section_id", "name")
        .populate({
          path: "video",
          select: "_id youtubeVideo_id video_url",
          
        })         
        if (!moduleData) {
            return res.status(404).json({ error: "Module not found." });
        }

        return res.status(200).json(moduleData);
    } catch (error) {
        console.error("Error fetching module details:", error.message);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

const getModulesBySectionId = async (req, res) => {
    try {
        const { section_id } = req.params;

        if (!section_id) {
            return res.status(400).json({ message: "Section ID is required." });
        }

        const sectionExists = await Section.findById(section_id);
        if (!sectionExists) {
            return res.status(404).json({ message: "Section not found." });
        }

        const modules = await Module.find({ section_id }, { name: 1, description: 1, _id: 1 });
        res.status(200).json(modules);
    } catch (error) {
        console.error("Error retrieving modules by section ID:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Update Module by ID
const updateModule = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        const module = await Module.findById(id);
        if (!module) {
            return res.status(404).json({ message: "Module not found." });
        }

        if (name) module.name = name;
        if (description) module.description = description;

        await module.save();
        res.status(200).json({ message: "Module updated successfully", module });
    } catch (error) {
        console.error("Error updating module:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

const deleteModule = async (req, res) => {
  try {
    const { id } = req.params;
    // This triggers the post hook on deletion.
    const deletedModule = await Module.findByIdAndDelete(id);
    if (!deletedModule) {
      return res.status(404).json({ message: "Module not found." });
    }
    res.status(200).json({ message: "Module deleted successfully" });
  } catch (error) {
    console.error("Error deleting module:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getModuleDetailsByUniqueModuleId = async (req, res) => {
  try {
    // Retrieve unique_ModuleID from the query string
    const { unique_ModuleID } = req.query;
    if (!unique_ModuleID) {
      return res.status(400).json({ message: "unique_ModuleID is required as a query parameter." });
    }

    const moduleData = await Module.findOne({ unique_ModuleID })
      .populate("section_id", "name")
      .populate("video", "title");

    if (!moduleData) {
      return res.status(404).json({ message: "Module not found." });
    }

    const response = {
      moduleName: moduleData.name,
      sectionName: moduleData.section_id ? moduleData.section_id.name : null,
      videoTitle: moduleData.video ? moduleData.video.title : null,
      moduleDescription: moduleData.description,
    };

    res.status(200).json({
      message: "Module details fetched successfully.",
      module: response,
    });
  } catch (error) {
    console.error("Error fetching module details:", error.message);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

const updateModuleName = async (req, res) => {
  try {
    const moduleId = req.params.moduleId;
    const { name } = req.body;
    
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: "A valid module name is required." });
    }
    
    // Use updateOne with a direct field query to avoid any ObjectId casting
    const result = await Module.updateOne(
      { unique_ModuleID: moduleId }, // Query by unique_ModuleID string
      { $set: { name: name.trim() } }  // Update only the name field
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Module not found." });
    }
    
    if (result.modifiedCount === 0) {
      return res.status(200).json({ message: "No changes needed, module name is already up to date." });
    }
    
    // Get the updated module to return in the response
    const updatedModule = await Module.findOne({ unique_ModuleID: moduleId });
    
    return res.status(200).json({
      message: "Module name updated successfully.",
      module: updatedModule
    });
    
  } catch (error) {
    console.error("Error updating module name:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
};


const getAllModulesForAdmin = async (req, res) => {
  try {
    // Step 1: Get basic module data with video, section and theme info.
    // Nested population is used to populate the video's learnedSkills field.
    const modules = await Module.find()
      .populate({
        path: "section_id",
        select: "name theme_id",
        populate: {
          path: "theme_id",
          select: "name"
        }
      })
      .populate({
        path: "video",
        select: "_id youtubeVideo_id video_url channel_name publish_date likes_count views_count learnedSkills",
        populate: {
          path: "learnedSkills",
          select: "skill_Name"
        }
      })
      .lean();

    // Extract module IDs for aggregation.
    const moduleIds = modules.map(module => module._id);

    // Step 2: Get completion counts.
    // Unwind the completed_modules array and group by the module_id inside it.
    const completionCounts = await UserProgress.aggregate([
      { $unwind: "$completed_modules" },
      {
        $match: {
          "completed_modules.module_id": { $in: moduleIds }
        }
      },
      {
        $group: {
          _id: "$completed_modules.module_id",
          count: { $sum: 1 }
        }
      }
    ]);

    // Create a lookup map for faster access.
    const completionMap = {};
    completionCounts.forEach(item => {
      // The _id here is a module_id.
      completionMap[item._id.toString()] = item.count;
    });

    // Step 3: Combine all data.
    const moduleData = modules.map(module => {
      const moduleId = module._id.toString();
      return {
        _id: module._id,
        unique_ModuleID: module.unique_ModuleID,
        moduleId: module._id,
        moduleName: module.name,
        sectionName: module.section_id ? module.section_id.name : 'Unknown Section',
        sectionId: module.section_id ? module.section_id._id : null,
        themeName:
          module.section_id && module.section_id.theme_id
            ? module.section_id.theme_id.name
            : 'Unknown Theme',
        themeId:
          module.section_id && module.section_id.theme_id
            ? module.section_id.theme_id._id
            : null,
        creationDate: module.createdAt,
        video: module.video
          ? {
              videoId: module.video._id,
              youtubeVideoId: module.video.youtubeVideo_id,
              videoUrl: module.video.video_url,
              channelName: module.video.channel_name,
              publishDate: module.video.publish_date,
              likesCount: module.video.likes_count || 0,
              viewsCount: module.video.views_count || 0,
              // Use the populated learnedSkills field.
              learnedSkills: module.video.learnedSkills
                ? module.video.learnedSkills.map(skill => ({
                    _id: skill._id,
                    skill_Name: skill.skill_Name
                  }))
                : []
            }
          : null,
        completionCount: completionMap[moduleId] || 0,
      };
    });

    // Return only the analytics data.
    res.status(200).json(moduleData);
  } catch (error) {
    console.error("Error retrieving module data:", error);
    res.status(500).json({ 
      message: "Internal Server Error", 
      error: error.message 
    });
  }
};

const updateModuleforAdmin = async (req, res) => {
  try {
    // Get the module ID from URL path parameter instead of query string
    const { moduleId } = req.params;
    if (!moduleId) {
      return res.status(400).json({ message: "Module ID is required." });
    }

    const updateData = req.body;

    // Find the module document by ID
    const moduleDoc = await Module.findById(moduleId);
    if (!moduleDoc) {
      return res.status(404).json({ message: "Module not found." });
    }

    // Update top-level module fields
    if (updateData.moduleName) moduleDoc.name = updateData.moduleName;
    if (updateData.themeName) moduleDoc.themeName = updateData.themeName;
    if (updateData.themeId) moduleDoc.theme_id = updateData.themeId;
    if (updateData.sectionName) moduleDoc.sectionName = updateData.sectionName;
    if (updateData.sectionId) moduleDoc.section_id = updateData.sectionId;

    // Check if the update includes video fields
    if (updateData.video) {
      // If the module already has an associated video, update its fields.
      if (moduleDoc.video) {
        const videoDoc = await Video.findById(moduleDoc.video);
        if (videoDoc) {
          if (updateData.video.videoUrl)
            videoDoc.video_url = updateData.video.videoUrl;
          if (updateData.video.learnedSkills)
            videoDoc.learnedSkills = updateData.video.learnedSkills;
          // Optionally, update other video fields if needed.
          await videoDoc.save();
        }
      } else {
        // Optional: Create a new video if the module doesn't have one.
        // Uncomment the code below if you wish to create a new Video document.
        /*
        const newVideo = new Video({
          youtubeVideo_id: updateData.video.youtubeVideo_id, // if provided
          title: updateData.video.title,                       // if provided
          description: updateData.video.description,           // if provided
          video_url: updateData.video.videoUrl,
          channel_id: updateData.video.channel_id,             // if provided
          channel_name: updateData.video.channel_name,         // if provided
          publish_date: updateData.video.publish_date,         // if provided
          likes_count: updateData.video.likes_count || 0,
          views_count: updateData.video.views_count || 0,
          tags: updateData.video.tags || [],
          learnedSkills: updateData.video.learnedSkills || [],
          module_id: moduleDoc._id,
        });
        await newVideo.save();
        moduleDoc.video = newVideo._id;
        */
      }
    }

    // Save the updated module
    await moduleDoc.save();

    return res.status(200).json({
      message: "Module updated successfully",
      module: moduleDoc,
    });
  } catch (error) {
    console.error("Error updating module:", error);
    return res.status(500).json({
      message: "Error updating module",
      error: error.message,
    });
  }
};


module.exports = { 
  createModule, 
  getModules, 
  getModuleById, 
  updateModule, 
  deleteModule, 
  getModulesBySectionId,
  getModuleDetailsByUniqueModuleId,
  updateModuleName,
  getAllModulesForAdmin,
  updateModuleforAdmin 
};  
