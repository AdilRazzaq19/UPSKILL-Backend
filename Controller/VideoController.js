// controllers/videoController.js
const Video = require("../Models/Video");
const Module = require("../Models/Module");
const axios = require("axios");
const iso8601 = require("iso8601-duration");
require("dotenv").config();
const mongoose = require("mongoose");

const API_KEY = process.env.YOUTUBE_API_KEY;

const extractVideoId = (url) => {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

const getTranscriptionByVideoId = async (req, res) => {
  try {
    const { video_id } = req.params;
    
    if (!video_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Video ID is required' 
      });
    }
    
    console.log(`Retrieving transcript for video ID: ${video_id}`);
    const client = mongoose.connection.client;
    
    // Explicitly connect to the upskill database
    const upskillDb = client.db('upskill');
    
    // Get the list of collections in the upskill database
    const collections = await upskillDb.listCollections().toArray();
    
    // First try with upskill_model.transcriptions
    const collectionName = 'upskill_model.transcriptions';
    console.log(`Checking if collection ${collectionName} exists`);
    
    const collectionExists = collections.some(c => c.name === collectionName);
    
    if (!collectionExists) {
      console.log(`Collection ${collectionName} does not exist in upskill database`);
      return res.status(404).json({
        success: false,
        message: `Collection ${collectionName} does not exist in upskill database`,
        availableCollections: collections.map(c => c.name)
      });
    }
    
    const transcriptionsCollection = upskillDb.collection(collectionName);
    
    // Get a count of documents
    const totalDocuments = await transcriptionsCollection.countDocuments();
    console.log(`Total documents in ${collectionName}: ${totalDocuments}`);
    
    if (totalDocuments === 0) {
      console.log(`Collection ${collectionName} exists but is empty`);
      return res.status(404).json({
        success: false,
        message: `Collection ${collectionName} exists but is empty`
      });
    }
    
    // Get sample document to verify collection structure
    const sampleDocument = await transcriptionsCollection.findOne({});
    console.log(`Sample document from collection:`, 
      sampleDocument ? Object.keys(sampleDocument) : 'No documents found');
    
    // Try to find the document with the specified video_id
    const result = await transcriptionsCollection.findOne({ video_id });
    
    if (result) {
      const transcriptValue = result.transcription || result.transcript || result.text || result.content;
      
      if (transcriptValue) {
        console.log("Transcript found");
        return res.status(200).json({ 
          success: true, 
          transcript: transcriptValue,
          transcription_path: result.transcription_path || result.path || null,
          mcq_data: result.mcq_data || null
        });
      } else {
        console.log("Document found but no transcript field:", Object.keys(result));
        return res.status(404).json({ 
          success: false, 
          message: "Document found but no transcript field available",
          availableFields: Object.keys(result)
        });
      }
    } else {
      // If not found by video_id, try other possible field names
      const possibleIdFields = ['youtubeVideo_id', 'videoId', 'youtube_id'];
      let foundDoc = null;
      
      for (const field of possibleIdFields) {
        console.log(`Trying to find document with ${field} = "${video_id}"`);
        foundDoc = await transcriptionsCollection.findOne({ [field]: video_id });
        if (foundDoc) {
          console.log(`Found document using field: ${field}`);
          break;
        }
      }
      
      if (foundDoc) {
        const transcriptValue = foundDoc.transcription || foundDoc.transcript || foundDoc.text || foundDoc.content;
        
        if (transcriptValue) {
          console.log("Transcript found");
          return res.status(200).json({ 
            success: true, 
            transcript: transcriptValue,
            transcription_path: foundDoc.transcription_path || foundDoc.path || null,
            mcq_data: foundDoc.mcq_data || null
          });
        } else {
          console.log("Document found but no transcript field:", Object.keys(foundDoc));
          return res.status(404).json({ 
            success: false, 
            message: "Document found but no transcript field available",
            availableFields: Object.keys(foundDoc)
          });
        }
      }
      
      // If still not found, check the videos collection for embedded transcripts
      console.log("Checking videos collection for embedded transcripts");
      const videosCollection = upskillDb.collection('videos');
      const video = await videosCollection.findOne({ youtubeVideo_id: video_id });
      
      if (video && (video.transcript || video.transcription)) {
        console.log("Found transcript in videos collection");
        return res.status(200).json({ 
          success: true, 
          transcript: video.transcript || video.transcription,
          note: "Found in videos collection"
        });
      }
      
      // If still not found, return 404
      return res.status(404).json({ 
        success: false, 
        message: "No transcript found for the specified video ID",
        note: "Checked both dedicated transcriptions collection and videos collection"
      });
    }
  } catch (error) {
    console.error("Error retrieving transcript:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to retrieve transcript", 
      error: error.message 
    });
  }
};
const getVideoDetails = async (req, res) => {
  try {
    const { videoUrl, module_id, tags } = req.body;
    
    if (!videoUrl) {
      return res.status(400).json({ error: "Video URL is required." });
    }
    const youtubeVideo_id = extractVideoId(videoUrl);
    if (!youtubeVideo_id) {
      return res.status(400).json({ error: "Invalid YouTube video URL." });
    }
    const existingModuleWithVideo = await Module.findOne({ video: { $ne: null } })
      .populate("video", "video_url")
      .where("video.video_url").equals(videoUrl);
    if (existingModuleWithVideo) {
      return res.status(400).json({ error: "This video URL is already assigned to another module." });
    }

    let existingVideo = await Video.findOne({ youtubeVideo_id });
    if (existingVideo) {
      if (existingVideo.module_id) {
        const assignedModule = await Module.findById(existingVideo.module_id);
        if (assignedModule) {
          return res.status(400).json({ error: "This video is already assigned to a module." });
        } else {
          existingVideo.module_id = null;
          await existingVideo.save();
        }
      }
      if (module_id) {
        const mod = await Module.findById(module_id);
        if (!mod) {
          return res.status(404).json({ error: "Module not found." });
        }
        if (mod.video) {
          return res.status(400).json({ error: "This module already has a video." });
        }
        mod.video = existingVideo._id;
        existingVideo.module_id = module_id;
        await mod.save();
        await existingVideo.save();
      }
      
      return res.status(200).json(existingVideo);
    }
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${youtubeVideo_id}&part=snippet,statistics,contentDetails&key=${API_KEY}`;
    const response = await axios.get(apiUrl);
    const data = response.data;
    if (!data.items || !data.items.length) {
      return res.status(404).json({ error: "Video not found on YouTube." });
    }

    const videoData = data.items[0];
    const snippet = videoData.snippet || {};
    const stats = videoData.statistics || {};
    const content = videoData.contentDetails || {};
    const durationParsed = iso8601.parse(content.duration || "PT0M0S");
    const formattedDuration = `${durationParsed.minutes || 0}:${
      durationParsed.seconds ? durationParsed.seconds.toString().padStart(2, "0") : "00"
    }`;

    const views = parseInt(stats.viewCount || "0", 10);
    const likes = parseInt(stats.likeCount || "0", 10);
    const comments = parseInt(stats.commentCount || "0", 10);
    const engagementScore = views ? ((likes + comments) / views * 100).toFixed(2) : "0";
    const newVideoData = {
      youtubeVideo_id,
      title: snippet.title,
      description: snippet.description,
      video_url: videoUrl,
      channel_id: snippet.channelId,
      channel_name: snippet.channelTitle,
      likes_count: likes,
      comments_count: comments,
      views_count: views,
      length: formattedDuration,
      publish_date: snippet.publishedAt ? snippet.publishedAt.split("T")[0] : null,
      category: snippet.categoryId,
      engagement_score: engagementScore,
      tags: tags || []
    };

    if (module_id) {
      newVideoData.module_id = module_id;
    }
    const newVideo = new Video(newVideoData);
    await newVideo.save();
    if (module_id) {
      const mod = await Module.findById(module_id);
      if (!mod) {
        return res.status(404).json({ error: "Module not found." });
      }
      if (mod.video) {
        return res.status(400).json({ error: "This module already has a video." });
      }
      mod.video = newVideo._id;
      await mod.save();
    }

    return res.status(201).json(newVideo);
  } catch (error) {
    console.error("Error fetching video details:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const updateVideoTags = async (req, res) => {
  try {
    const { videoId } = req.params;  
    const { newTags } = req.body;  

    if (!newTags || !Array.isArray(newTags)) {
      return res.status(400).json({ error: "New tags must be provided as an array." });
    }

    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ error: "Video not found." });
    }

    video.tags = newTags;
    await video.save();

    return res.status(200).json({
      message: "Video tags updated successfully.",
      videoId: video._id,
      newTags: video.tags
    });
  } catch (error) {
    console.error("Error updating video tags:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};



const getAllVideos = async (req, res) => {
  try {
    const videos = await Video.find({});
    return res.status(200).json(videos);
  } catch (error) {
    console.error("Error fetching videos:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};


const deleteVideo = async (req, res) => {
  try {
    const { videoId } = req.params;
    if (!videoId) {
      return res.status(400).json({ error: "Video ID is required." });
    }

    const deletedVideo = await Video.findOneAndDelete({ _id: videoId });
    if (!deletedVideo) {
      return res.status(404).json({ error: "Video not found." });
    }

    res.status(200).json({ message: "Video deleted successfully.", video: deletedVideo });
  } catch (error) {
    console.error("Error deleting video:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
const getVideoDetailsByModuleId = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized: user id missing." });
    }
    const { moduleId } = req.params;
    
    const moduleData = await Module.findById(moduleId).populate({
      path: "video",
      populate: [
        { path: "quizzes", model: "VideoQuiz" },
        { path: "flashcards", model: "FlashcardResponse", select: "video_id transcription_id section content" },
        {path:"learnedSkills",model:"Skill"}
      ]
    });

    if (!moduleData) {
      return res.status(404).json({ message: "Module not found." });
    }

    if (!moduleData.video) {
      return res.status(404).json({ message: "No video assigned to this module." });
    }

    res.status(200).json({
      message: "Video details fetched successfully.",
      user_id: req.user.id,
      module_id: moduleId,
      videoDetails: moduleData.video,
    });
  } catch (error) {
    console.error("Error fetching video details:", error.message);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};



const getVideoWithQuizzes = async (req, res) => {
  try {
    const { videoId } = req.params;
    const video = await Video.findById(videoId)
      .populate('quizzes'); 

    if (!video) {
      return res.status(404).json({ message: 'Video not found.' });
    }

    return res.status(200).json({ video });
  } catch (error) {
    console.error('Error fetching video:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


const searchModulesBySkill = async (req, res) => {
  try {
    const { skill } = req.query;
    if (!skill) {
      return res.status(400).json({ error: "Skill name is required." });
    }

    const modules = await Module.aggregate([
      {
        $lookup: {
          from: "videos",
          localField: "video",
          foreignField: "_id",
          as: "videoDetails"
        }
      },
      { $unwind: "$videoDetails" },
      {
        $lookup: {
          from: "skills",
          localField: "videoDetails.learnedSkills",
          foreignField: "_id",
          as: "videoDetails.learnedSkills"
        }
      },
      {
        $match: {
          "videoDetails.learnedSkills": {
            $elemMatch: { 
              skill_Name: { $regex: skill, $options: "i" } 
            }
          }
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          videoDetails: 1
        }
      }
    ]);

    res.status(200).json({
      message: "Modules with matching skill fetched successfully.",
      data: modules
    });
  } catch (error) {
    console.error("Error searching modules by skill:", error.message);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};


const updateChannelProfileImageForVideo = async (req, res) => {
  try {
    const { videoId } = req.params;
    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ error: "Video not found." });
    }
    if (!video.channel_id) {
      return res.status(400).json({ error: "Channel ID missing from video." });
    }
    
    // Call YouTube Channels API to get the channel details including the profile image.
    const channelApiUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${video.channel_id}&key=${API_KEY}`;
    const response = await axios.get(channelApiUrl);
    
    if (
      !response.data.items ||
      response.data.items.length === 0 ||
      !response.data.items[0].snippet ||
      !response.data.items[0].snippet.thumbnails
    ) {
      return res.status(404).json({ error: "Channel details not found." });
    }
    
    const channelSnippet = response.data.items[0].snippet;
    const profileImageUrl = channelSnippet.thumbnails.high
      ? channelSnippet.thumbnails.high.url
      : channelSnippet.thumbnails.default.url;
    video.channel_profile_image = profileImageUrl;
    await video.save();
    
    return res.status(200).json({
      message: "Channel profile image updated successfully.",
      videoId: video._id,
      channel_profile_image: video.channel_profile_image,
    });
  } catch (error) {
    console.error("Error updating channel profile image:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const getQuizzesByYoutubeVideoId = async (req, res) => {
  try {
    const { youtubeVideoId } = req.params;

    if (!youtubeVideoId) {
      return res.status(400).json({ error: "YouTube Video ID is required." });
    }

    // Find the video by YouTube Video ID
    const video = await Video.findOne({ youtubeVideo_id: youtubeVideoId }).populate('quizzes');

    if (!video) {
      return res.status(404).json({ error: "Video not found." });
    }

    if (!video.quizzes || video.quizzes.length === 0) {
      return res.status(404).json({ error: "No quizzes found for this video." });
    }

    // Extract and return only the mcqs array
    const mcqsArray = video.quizzes.map(quiz => quiz.mcqs).flat();

    return res.status(200).json(mcqsArray);
  } catch (error) {
    console.error("Error fetching quizzes by YouTube Video ID:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const getIntroductionByYoutubeVideoId = async (req, res) => {
  try {
    const { youtubeVideoId } = req.params;

    if (!youtubeVideoId) {
      return res.status(400).json({ error: "YouTube Video ID is required." });
    }

    // Find the video by YouTube Video ID and populate the flashcards
    const video = await Video.findOne({ youtubeVideo_id: youtubeVideoId }).populate({
      path: 'flashcards',
      model: 'FlashcardResponse',
      select: 'section content'
    });

    if (!video) {
      return res.status(404).json({ error: "Video not found." });
    }

    console.log("Video found:", video); // Log the video details

    // Extract the introduction section from flashcards
    const introductionFlashcard = video.flashcards.find(flashcard => flashcard.section === "introduction");

    if (!introductionFlashcard) {
      console.log("Flashcards available:", video.flashcards); // Log available flashcards
      return res.status(404).json({ error: "Introduction not found for this video." });
    }

    return res.status(200).json({ introduction: introductionFlashcard.content });
  } catch (error) {
    console.error("Error fetching introduction by YouTube Video ID:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const getKeyLearningByYoutubeVideoId = async (req, res) => {
  try {
    const { youtubeVideoId } = req.params;

    if (!youtubeVideoId) {
      return res.status(400).json({ error: "YouTube Video ID is required." });
    }

    // Find the video by YouTube Video ID and populate the flashcards
    const video = await Video.findOne({ youtubeVideo_id: youtubeVideoId }).populate({
      path: 'flashcards',
      model: 'FlashcardResponse',
      select: 'section content'
    });

    if (!video) {
      return res.status(404).json({ error: "Video not found." });
    }

    // Extract the key learning section from flashcards
    const keyLearningFlashcard = video.flashcards.find(flashcard => flashcard.section === "key_learnings");

    if (!keyLearningFlashcard) {
      return res.status(404).json({ error: "Key Learning not found for this video." });
    }

    return res.status(200).json({ keyLearning: keyLearningFlashcard.content });
  } catch (error) {
    console.error("Error fetching key learning by YouTube Video ID:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const getExecutiveSummaryByYoutubeVideoId = async (req, res) => {
  try {
    const { youtubeVideoId } = req.params;

    if (!youtubeVideoId) {
      return res.status(400).json({ error: "YouTube Video ID is required." });
    }

    // Find the video by YouTube Video ID and populate the flashcards
    const video = await Video.findOne({ youtubeVideo_id: youtubeVideoId }).populate({
      path: 'flashcards',
      model: 'FlashcardResponse',
      select: 'section content'
    });

    if (!video) {
      return res.status(404).json({ error: "Video not found." });
    }

    // Extract the executive summary section from flashcards
    const executiveSummaryFlashcard = video.flashcards.find(flashcard => flashcard.section === "summary_points");

    if (!executiveSummaryFlashcard) {
      return res.status(404).json({ error: "Executive Summary not found for this video." });
    }

    return res.status(200).json({ executiveSummary: executiveSummaryFlashcard.content });
  } catch (error) {
    console.error("Error fetching executive summary by YouTube Video ID:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { 
  getVideoDetails, 
  getAllVideos,
  deleteVideo,
  getVideoDetailsByModuleId, 
  getVideoWithQuizzes,
  updateVideoTags,  
  searchModulesBySkill,
  updateChannelProfileImageForVideo,
  getQuizzesByYoutubeVideoId, 
  getIntroductionByYoutubeVideoId, 
  getKeyLearningByYoutubeVideoId,
  getExecutiveSummaryByYoutubeVideoId,
  getTranscriptionByVideoId // Add the new function to the exports
};