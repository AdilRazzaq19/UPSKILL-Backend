// routes/videoChatRoutes.js
const express = require('express');
const router = express.Router();
const { validatePayload, videoChatController, generalChatController,getChatHistory,generalChatStreamController,videoChatStreamController } = require('../Controller/ChatController');
const { authMiddleware } = require("../middleware/auth.middleware");

router.post('/video/:video_id', authMiddleware,validatePayload, videoChatController);
router.post('/general', authMiddleware,validatePayload, generalChatController);
router.get("/chat-history", authMiddleware,getChatHistory);
router.post('/general-chat-stream', authMiddleware,generalChatStreamController);
router.post('/video-chat-stream/:video_id', authMiddleware,videoChatStreamController);
router.get('/session/video', authMiddleware, async (req, res) => {
    try {
      const Onboarding = require('../Models/Onboarding');
      const onboarding = await Onboarding.findOne({ user_id: req.user._id });
      if (!onboarding) {
        return res.status(404).json({ message: 'Onboarding not found.' });
      }
      res.status(200).json({ videoChatSessionId: onboarding.videoChatSessionId });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  });
    
  router.get('/session/general', authMiddleware, async (req, res) => {
    try {
      const Onboarding = require('../Models/Onboarding');
      const onboarding = await Onboarding.findOne({ user_id: req.user._id });
      if (!onboarding) {
        return res.status(404).json({ message: 'Onboarding not found.' });
      }
      res.status(200).json({ generalChatSessionId: onboarding.generalChatSessionId });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  });
  
module.exports = router;
