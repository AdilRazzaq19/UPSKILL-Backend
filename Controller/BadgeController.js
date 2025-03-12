const Badge = require("../Models/Badge");

// Create a new badge
const createBadge = async (req, res) => {
  try {
    const { name, type, description, tagline, points, criteria, hidden } = req.body;

    // Validate all required fields.
    if (!name || !type || !description || !tagline || points === undefined || !criteria || hidden === undefined) {
      return res.status(400).json({ 
        message: "All fields (name, type, description, tagline, points, criteria, hidden) are required." 
      });
    }

    // Check if a badge with the same name already exists.
    const existingBadge = await Badge.findOne({ name });
    if (existingBadge) {
      return res.status(400).json({ message: "A badge with this name already exists." });
    }

    const badge = new Badge({ name, type, description, tagline, points, criteria, hidden });
    await badge.save();

    res.status(201).json({ message: "Badge created successfully", badge });
  } catch (error) {
    console.error("Error creating badge:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Retrieve all badges
const getBadges = async (req, res) => {
  try {
    const badges = await Badge.find();
    res.status(200).json(badges);
  } catch (error) {
    console.error("Error fetching badges:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Retrieve a badge by ID
const getBadgeById = async (req, res) => {
  try {
    const { id } = req.params;
    const badge = await Badge.findById(id);
    if (!badge) {
      return res.status(404).json({ message: "Badge not found" });
    }
    res.status(200).json(badge);
  } catch (error) {
    console.error("Error fetching badge:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update a badge (allow partial updates)
const updateBadge = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "At least one field must be provided for update." });
    }

    // If the name is updated, check for conflicts.
    if (updateData.name) {
      const badgeWithSameName = await Badge.findOne({ name: updateData.name, _id: { $ne: id } });
      if (badgeWithSameName) {
        return res.status(400).json({ message: "Another badge with this name already exists." });
      }
    }

    // Update only provided fields.
    const badge = await Badge.findByIdAndUpdate(id, updateData, { new: true });
    if (!badge) {
      return res.status(404).json({ message: "Badge not found" });
    }

    res.status(200).json({ message: "Badge updated successfully", badge });
  } catch (error) {
    console.error("Error updating badge:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete a badge
const deleteBadge = async (req, res) => {
  try {
    const { id } = req.params;
    const badge = await Badge.findByIdAndDelete(id);
    if (!badge) {
      return res.status(404).json({ message: "Badge not found" });
    }
    res.status(200).json({ message: "Badge deleted successfully" });
  } catch (error) {
    console.error("Error deleting badge:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  createBadge,
  getBadges,
  getBadgeById,
  updateBadge,
  deleteBadge,
};
