const Module = require("../Models/Module");
const Section = require("../Models/Section");
const FlashcardResponse = require("../Models/FlashCard");
const Theme = require("../Models/Theme");
const UserProgress = require("../Models/userProgress");
const Video = require('../Models/Video'); // Adjust path if needed
const Skill  = require("../Models/Skill");  

const createModule = async (req, res) => {
  // if (req.userRole !== "admin") {
  //   return res.status(403).json({ message: "Access denied: Admins only." });
  // }
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
  if (req.userRole !== "admin") {
    return res.status(403).json({ message: "Access denied: Admins only." });
  }
  try {
    const { id } = req.params;
    // This triggers any post hook on deletion.
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
    // Check if the authenticated user is an admin.
    if (req.userRole !== "admin") {
      return res.status(403).json({ message: "Access denied: Admins only." });
    }

    // Step 1: Get basic module data with video, section, and theme info.
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
      completionMap[item._id.toString()] = item.count;
    });

    // Step 3: Combine data.
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
    // 1) Admin check
    if (req.userRole !== "admin") {
      return res.status(403).json({ message: "Admins only." });
    }

    // 2) moduleId param
    const { moduleId } = req.params;
    if (!moduleId) {
      return res.status(400).json({ message: "Module ID is required." });
    }

    const updateData = req.body;
    console.log("Update data:", updateData);

    // 3) Load module
    const moduleDoc = await Module.findById(moduleId);
    if (!moduleDoc) {
      return res.status(404).json({ message: "Module not found." });
    }

    // 4) Update the module name
    if (updateData.moduleName) {
      moduleDoc.name = updateData.moduleName;
    }

    // 5) Update theme relationship and (if requested) rename the Theme
    if (updateData.themeId || updateData.themeName) {
      let themeDoc = null;

      if (updateData.themeId) {
        themeDoc = await Theme.findById(updateData.themeId);
      }
      if (!themeDoc && updateData.themeName) {
        themeDoc = await Theme.findOne({ name: updateData.themeName });
      }
      if (!themeDoc) {
        return res.status(400).json({ message: "Theme not found." });
      }

      // assign the foreign key
      moduleDoc.theme_id = themeDoc._id;

      // if the client supplied a new name, update the Theme record too
      if (updateData.themeName && updateData.themeName !== themeDoc.name) {
        themeDoc.name = updateData.themeName;
        await themeDoc.save();
      }
    }

    // 6) Update section relationship and (if requested) rename the Section
    if (updateData.sectionId || updateData.sectionName) {
      let sectionDoc = null;

      if (updateData.sectionId) {
        sectionDoc = await Section.findById(updateData.sectionId);
      }
      if (!sectionDoc && updateData.sectionName) {
        sectionDoc = await Section.findOne({ name: updateData.sectionName });
      }
      if (!sectionDoc) {
        return res.status(400).json({ message: "Section not found." });
      }

      moduleDoc.section_id = sectionDoc._id;

      if (updateData.sectionName && updateData.sectionName !== sectionDoc.name) {
        sectionDoc.name = updateData.sectionName;
        await sectionDoc.save();
      }
    }

    // 7) Update video + skills
    if (updateData.video && moduleDoc.video) {
      const videoDoc = await Video.findById(moduleDoc.video);
      if (videoDoc) {
        if (updateData.video.videoUrl) {
          videoDoc.video_url = updateData.video.videoUrl;
        }
        if (Array.isArray(updateData.video.learnedSkills)) {
          const skillIds = [];
          for (const skillItem of updateData.video.learnedSkills) {
            const skillName = typeof skillItem === "object"
              ? skillItem.skill_Name
              : String(skillItem);

            // try by ID first
            let skillDoc = (typeof skillItem === "object" && skillItem._id)
              ? await Skill.findById(skillItem._id)
              : null;

            // then by name
            if (!skillDoc) {
              skillDoc = await Skill.findOne({ skill_Name: skillName })
                       || await Skill.findOne({ skill_Name: new RegExp(`^${skillName}$`, "i") });
            }

            // create if missing
            if (!skillDoc) {
              skillDoc = await Skill.create({
                skill_Name:      skillName,
                skill_section:   "General",
                skill_description:`Auto-created for ${skillName}`
              });
            }

            skillIds.push(skillDoc._id);
          }
          videoDoc.learnedSkills = skillIds;
        }
        await videoDoc.save();
      }
    }

    // 8) Persist the module
    await moduleDoc.save();

    // 9) Re-fetch with populated relationships
    const populated = await Module.findById(moduleId)
      .populate({ path: "theme_id",   select: "name" })
      .populate({ path: "section_id", select: "name" })
      .populate({
        path: "video",
        populate: { path: "learnedSkills", model: "Skill", select: "skill_Name" }
      });

    if (!populated) {
      return res.status(404).json({ message: "Module gone missing." });
    }

    // 10) Build final response
    const responseModule = {
      _id:             populated._id,
      unique_ModuleID: populated.unique_ModuleID,
      moduleName:      populated.name,
      themeId:         populated.theme_id?._id,
      themeName:       populated.theme_id?.name,
      sectionId:       populated.section_id?._id,
      sectionName:     populated.section_id?.name,
      video: populated.video
        ? {
            _id:            populated.video._id,
            videoUrl:       populated.video.video_url,
            learnedSkills:  populated.video.learnedSkills.map(s => ({
              _id:         s._id,
              skill_Name:  s.skill_Name
            }))
          }
        : null
    };

    return res.status(200).json({
      message: "Module updated successfully",
      module:  responseModule
    });
  } catch (err) {
    console.error("Error in updateModuleforAdmin:", err);
    return res.status(500).json({
      message: "Server error updating module",
      error:   err.message
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
