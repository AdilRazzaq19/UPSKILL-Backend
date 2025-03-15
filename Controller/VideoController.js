// controllers/videoController.js
const Video = require("../Models/Video");
const Module = require("../Models/Module");
const axios = require("axios");
const iso8601 = require("iso8601-duration");
require("dotenv").config();

const API_KEY = process.env.YOUTUBE_API_KEY;

const extractVideoId = (url) => {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
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


module.exports = { getVideoDetails, getAllVideos,deleteVideo,getVideoDetailsByModuleId, 
  getVideoWithQuizzes,updateVideoTags,  searchModulesBySkill,updateChannelProfileImageForVideo
};
