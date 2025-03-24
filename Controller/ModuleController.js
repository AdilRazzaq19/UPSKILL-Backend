const Module = require("../Models/Module");
const Section = require("../Models/Section");

  const createModule = async (req, res) => {
    try {
      const { unique_ModuleID, name, description, section_id, prerequisites } = req.body;

      if (req.userRole !== "admin") {
        return res.status(403).json({ message: "Only admins can create modules." });
      }

      if (!unique_ModuleID || !name || !description || !section_id) {
        return res.status(400).json({ message: "unique_ModuleID, name, description, and section_id are required." });
      }

      const existingModule = await Module.findOne({ unique_ModuleID });
      if (existingModule) {
        return res.status(400).json({ message: "A module with this unique_ModuleID already exists." });
      }

      const sectionExists = await Section.findById(section_id);
      if (!sectionExists) {
        return res.status(404).json({ message: "Section not found." });
      }

      if (prerequisites && prerequisites.length > 0) {
        const prerequisiteModules = await Module.find({ _id: { $in: prerequisites } });
        if (prerequisiteModules.length !== prerequisites.length) {
          return res.status(400).json({ message: "One or more prerequisite modules do not exist." });
        }
        if (prerequisites.includes(unique_ModuleID)) {
          return res.status(400).json({ message: "A module cannot be its own prerequisite." });
        }
      }

      const newModule = new Module({
        unique_ModuleID,
        name,
        description,
        section_id,
        prerequisites,
        });
      await newModule.save();

      sectionExists.modules.push(newModule._id);
      await sectionExists.save();

      res.status(201).json({ message: "Module created successfully", module: newModule });
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
          select: "_id youtubeVideo_id video_url channel_name"
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




module.exports = { 
  createModule, 
  getModules, 
  getModuleById, 
  updateModule, 
  deleteModule, 
  getModulesBySectionId,
  getModuleDetailsByUniqueModuleId,
  updateModuleName
};
