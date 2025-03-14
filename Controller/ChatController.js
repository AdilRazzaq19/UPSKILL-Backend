// Controller/ChatController.js
const axios = require('axios');
const Onboarding = require('../Models/Onboarding'); 

const validatePayload = (req, res, next) => {
  const {
    user_message,
    user_role,
    department,
    industry,
    ai_skill_level,
    digital_fluency,
    leadership_manager,
    company_size
  } = req.body;

  if (
    !user_message ||
    !user_role ||
    !department ||
    !industry ||
    !ai_skill_level ||
    !digital_fluency ||
    !leadership_manager ||
    !company_size
  ) {
    return res.status(400).json({ message: "Missing required fields in payload" });
  }
  next();
};

const videoChatController = async (req, res) => {
  const video_id = req.params.video_id;
  if (!video_id) {
    return res.status(400).json({ message: "video_id is required as a URL parameter" });
  }

  try {
    const response = await axios.post(
      `http://35.180.225.153/v2/video-chat/?video_id=${video_id}`,
      req.body,
      {
        headers: {
          'Content-Type': 'application/json',
          'accept': 'application/json'
        }
      }
    );

    const newSessionId = response.data.session_id;
    if (newSessionId) {
      await Onboarding.findOneAndUpdate(
        { user_id: req.user._id },
        { videoChatSessionId: newSessionId },
        { new: true }
      );
    }
    res.status(200).json(response.data);
  } catch (error) {
    console.error("Error calling external Video Chat API:", error.message);
    if (error.response && error.response.data) {
      return res.status(error.response.status).json({
        message: "Error from Video Chat API",
        error: error.response.data
      });
    }
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message
    });
  }
};

const generalChatController = async (req, res) => {
  try {
    const response = await axios.post(
      `http://35.180.225.153/v2/general-chat/`,
      req.body,
      {
        headers: {
          'Content-Type': 'application/json',
          'accept': 'application/json'
        }
      }
    );
    const newSessionId = response.data.session_id;
    if (newSessionId) {
      await Onboarding.findOneAndUpdate(
        { user_id: req.user._id },
        { generalChatSessionId: newSessionId },
        { new: true }
      );
    }
    res.status(200).json(response.data);
  } catch (error) {
    console.error("Error calling external General Chat API:", error.message);
    if (error.response && error.response.data) {
      return res.status(error.response.status).json({
        message: "Error from General Chat API",
        error: error.response.data
      });
    }
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message
    });
  }
};

const getChatHistory = async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) {
      return res.status(400).json({ error: "session_id is required" });
    }
    
    const response = await axios.get("http://35.180.225.153/v2/chat-history/", {
      params: { session_id },
      headers: { Accept: "application/json" }
    });
    
    res.status(200).json({
      message: "Chat history fetched successfully.",
      data: response.data
    });
  } catch (error) {
    console.error("Error calling external Chat History API:", error.message);
    res.status(500).json({ error: "Failed to fetch chat history." });
  }
};

module.exports = {
  validatePayload,
  videoChatController,
  generalChatController,
  getChatHistory
};
