const Section = require("../Models/Section");
const Theme = require("../Models/Theme");

// Create a new Section 

const createSection = async (req, res) => {
    try {
        const { theme_id, name } = req.body;

        if (!theme_id) {
            return res.status(400).json({ message: "Theme ID is required." });
        }
        const themeExists = await Theme.findById(theme_id);
        if (!themeExists) {
            return res.status(404).json({ message: "Theme not found." });
        }
        const existingSection = await Section.findOne({ theme_id, name });
        if (existingSection) {
            return res.status(400).json({ message: "A section with this name already exists under this theme." });
        }

        const newSection = new Section({ theme_id, name });
        await newSection.save();

        themeExists.sections.push(newSection._id);
        await themeExists.save();

        res.status(201).json({
            message: "Section created successfully",
            section: newSection
        });
    } catch (error) {
        console.error(" Error creating section:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};



//  Get All Sections 
const getSections = async (req, res) => {
    try {
        const sections = await Section.find().populate("theme_id", "name");

        res.status(200).json(sections);
    } catch (error) {
        console.error("❌ Error retrieving sections:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};


// Get Sections by Theme ID
const getSectionsByThemeId = async (req, res) => {
    try {
        const { theme_id } = req.params;

        if (!theme_id) {
            return res.status(400).json({ message: "Theme ID is required." });
        }

        const themeExists = await Theme.findById(theme_id);
        if (!themeExists) {
            return res.status(404).json({ message: "Theme not found." });
        }

        // Fetch only section name and ID
        const sections = await Section.find({ theme_id }, { name: 1, _id: 1 });

        res.status(200).json(sections);
    } catch (error) {
        console.error("❌ Error retrieving sections by theme ID:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};


// Get a Single Section by ID 
const getSectionById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ message: "Section ID is required." });
        }
        const section = await Section.findById(id).populate("theme_id", "name");
        if (!section) {
            return res.status(404).json({ message: "Section not found." });
        }

        res.status(200).json(section);
    } catch (error) {
        console.error(" Error retrieving section:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// update Section
    const updateSection = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ message: "Section name is required." });
        }

        const section = await Section.findById(id);
        if (!section) {
            return res.status(404).json({ message: "Section not found." });
        }

        const duplicateSection = await Section.findOne({ theme_id: section.theme_id, name });
        if (duplicateSection) {
            return res.status(400).json({ message: "A section with this name already exists under this theme." });
        }

        section.name = name;
        await section.save();

        res.status(200).json({ message: "Section updated successfully", section });
    } catch (error) {
        console.error(" Error updating section:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};




// Delete Section by ID 
const deleteSection = async (req, res) => {
    try {
        const { id } = req.params;
        const section = await Section.findById(id);
        if (!section) {
            return res.status(404).json({ message: "Section not found." });
        }
        await Section.findByIdAndDelete(id);
        res.status(200).json({ message: "Section deleted successfully" });
    } catch (error) {
        console.error("❌ Error deleting section:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

module.exports = { createSection, getSections,getSectionsByThemeId, getSectionById, updateSection, deleteSection };
