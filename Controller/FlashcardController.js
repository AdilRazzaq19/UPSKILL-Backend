const axios = require('axios');
const FlashcardResponse = require('../Models/FlashCard');
const Video = require('../Models/Video');

const storeFlashcards = async (req, res) => {
  const video_id = req.params.video_id;

  try {
    // Fetch flashcard data from the external API
    const response = await axios.get("http://35.180.225.153/v2/notes/", {
      params: { video_id }
    });

    let flashcardArray = [];
    if (Array.isArray(response.data)) {
      flashcardArray = response.data;
    } else if (response.data && Array.isArray(response.data.notes)) {
      flashcardArray = response.data.notes;
    } else {
      return res.status(400).json({ message: "Invalid flashcard data format from external API" });
    }

    // For each flashcard object (which represents one section) update or create a document.
    const flashcardDocs = [];
    for (const fc of flashcardArray) {
      // Ensure that the section is provided; it should be one of the allowed values.
      const section = fc.section || "";
      if (!section) continue; // Skip if no section is provided

      // Check if a document for this video and section already exists
      let flashcardDoc = await FlashcardResponse.findOne({ video_id, section });
      if (flashcardDoc) {
        // Update the existing document's transcription_id and content
        flashcardDoc.transcription_id = fc.transcription_id || flashcardDoc.transcription_id;
        flashcardDoc.content = fc.content || flashcardDoc.content;
        await flashcardDoc.save();
      } else {
        // Create a new document for the section
        flashcardDoc = new FlashcardResponse({
          video_id,
          transcription_id: fc.transcription_id || "",
          section,
          content: fc.content || ""
        });
        await flashcardDoc.save();
      }
      flashcardDocs.push(flashcardDoc);
    }
    const video = await Video.findOne({ youtubeVideo_id: video_id });
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }
    video.flashcards = flashcardDocs.map(doc => doc._id);
    await video.save();

    res.status(200).json({
      message: "Flashcards (introduction, key_learnings, summary_points) stored successfully and linked to video",
      flashcards: flashcardDocs,
      count: flashcardDocs.length
    });
  } catch (error) {
    console.error("Error storing flashcards:", error);
    res.status(500).json({
      message: "Failed to store flashcards",
      error: error.message
    });
  }
};

module.exports = { storeFlashcards };
