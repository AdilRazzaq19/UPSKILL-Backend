const Theme=require("../Models/Theme")


// Create Theme
const createTheme = async (req, res) => {
    try {
        const { name } = req.body;
        const newTheme = new Theme({ name });
        await newTheme.save();
        res.status(201).json({ message: "Theme created successfully", theme: newTheme });
    } catch (error) {
        console.error("Error creating theme:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

const getThemes = async (req, res) => {
    try {
        const themes = await Theme.find() 
            .populate({
                path: "sections",
                select: "name _id", 
                populate: {
                    path: "modules",
                    select: "name _id", 
                },
            });

        res.status(200).json(themes);
    } catch (error) {
        console.error("Error retrieving themes:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};


// Get Single Theme
const getThemeById = async (req, res) => {
    try {
        const theme = await Theme.findById(req.params.id);
        if (!theme) {
            return res.status(404).json({ message: "Theme not found" });
        }
        res.status(200).json(theme);
    } catch (error) {
        console.error("Error retrieving theme:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Update Theme
const updateTheme = async (req, res) => {
    try {
        const updatedTheme = await Theme.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json( {message: "Theme Updated successfully",updatedTheme: updatedTheme});
    } catch (error) {
        console.error("Error updating theme:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};


// Delete Theme
const deleteTheme = async (req, res) => {
    try {
        await Theme.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Theme deleted successfully"  });
    } catch (error) {
        console.error("Error deleting theme:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

module.exports = { createTheme, getThemes, getThemeById, updateTheme, deleteTheme };