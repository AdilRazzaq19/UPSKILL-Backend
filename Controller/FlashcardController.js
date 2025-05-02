const mongoose = require('mongoose');
const FlashcardResponse = require('../Models/FlashCard');
const Video = require('../Models/Video');

const storeFlashcards = async (req, res) => {
  const { video_id } = req.params;

  if (!video_id) {
    return res.status(400).json({
      success: false,
      message: 'Video ID is required'
    });
  }

  try {
    console.log(`Storing flashcards for video ID: ${video_id}`);
    const client = mongoose.connection.client;
    const upskillDb = client.db('upskill');

    // Ensure notes collection exists
    const collections = await upskillDb.listCollections().toArray();
    const notesCollName = 'upskill_model.notes';
    if (!collections.some(c => c.name === notesCollName)) {
      return res.status(404).json({
        success: false,
        message: `Notes collection "${notesCollName}" not found`,
        available: collections.map(c => c.name)
      });
    }

    const notesCollection = upskillDb.collection(notesCollName);
    const total = await notesCollection.countDocuments();
    if (total === 0) {
      return res.status(404).json({
        success: false,
        message: `Notes collection "${notesCollName}" is empty`
      });
    }

    // Fetch all note docs for this video_id (with fallbacks)
    let noteDocs = await notesCollection.find({ video_id }).toArray();
    if (noteDocs.length === 0) {
      const altFields = ['youtubeVideo_id', 'videoId', 'youtube_id'];
      for (const f of altFields) {
        noteDocs = await notesCollection.find({ [f]: video_id }).toArray();
        if (noteDocs.length) break;
      }
    }

    if (noteDocs.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No notes found for video ID ${video_id}`
      });
    }

    // Upsert each note into FlashcardResponse
    const flashcardDocs = [];
    for (const note of noteDocs) {
      const section = note.section || '';
      if (!section) continue;

      const transcription_id = note.transcription_id || '';
      const content = note.content || '';

      let fc = await FlashcardResponse.findOne({ video_id, section });
      if (fc) {
        fc.transcription_id = transcription_id;
        fc.content = content;
        await fc.save();
      } else {
        fc = await FlashcardResponse.create({
          video_id,
          transcription_id,
          section,
          content
        });
      }
      flashcardDocs.push(fc);
    }

    // Link flashcards array to the Video
    const video = await Video.findOne({ youtubeVideo_id: video_id });
    if (!video) {
      return res.status(404).json({ 
        success: false,
        message: `Video with youtubeVideo_id "${video_id}" not found`
      });
    }

    video.flashcards = flashcardDocs.map(d => d._id);
    await video.save();

    return res.status(200).json({
      success: true,
      message: 'Flashcards stored and linked successfully',
      count: flashcardDocs.length,
      flashcards: flashcardDocs
    });
  } catch (err) {
    console.error('Error storing flashcards:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to store flashcards',
      error: err.message
    });
  }
};

module.exports = { storeFlashcards };
