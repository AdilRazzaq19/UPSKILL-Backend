// Controller/ChatController.js
const axios = require('axios');
const Onboarding = require('../Models/Onboarding'); 
const Module = require("../Models/Module"); 
const { createParser, ParsedEvent } = require('eventsource-parser');

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
      `http://15.237.7.12/v3/video-chat/?video_id=${video_id}`,
      req.body,
      {
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
        },
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

    const moduleId = response.data.module_id;
    if (moduleId) {
      // Query the module by unique_ModuleID to get its ObjectId.
      const moduleDetail = await Module.findOne({ unique_ModuleID: moduleId }).populate('video');
      if (moduleDetail) {
        response.data.module_name = moduleDetail.name;
        response.data.module_object_id = moduleDetail._id; // ObjectId from the DB.
        response.data.channel_name = moduleDetail.video ? moduleDetail.video.channel_name : null;
      } else {
        response.data.module_name = null;
        response.data.channel_name = null;
      }
    }

    res.status(200).json(response.data);
  } catch (error) {
    console.error("Error calling external Video Chat API:", error.message);
    if (error.response && error.response.data) {
      return res.status(error.response.status).json({
        message: "Error from Video Chat API",
        error: error.response.data,
      });
    }
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
const videoChatStreamController = async (req, res) => {
  const { video_id } = req.params;
  if (!video_id) {
    return res.status(400).json({ error: "Missing video_id path parameter." });
  }

  // 1) SSE + keep‑alive headers
  res.setHeader('Content-Type',      'text/event-stream');
  res.setHeader('Cache-Control',     'no-cache');
  res.setHeader('Connection',        'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');    // disable buffering in nginx
  req.noCompression = true;                    // disable express compression
  res.flushHeaders();                          // send headers immediately

  // 2) Stream endpoint with query param
  const externalUrl = `http://15.237.7.12/v3/video-chat-stream/?video_id=${encodeURIComponent(video_id)}`;

  try {
    // 3) POST the client's body directly, leave video_id in the URL
    const upstream = await axios.post(
      externalUrl,
      req.body,
      {
        responseType: 'stream',
        headers: {
          'Content-Type': 'application/json',
          'Accept':       'text/event-stream'
        }
      }
    );

    // 4) Pipe + intercept session_id
    upstream.data.on('data', chunk => {
      const text = chunk.toString();

      // if this chunk carries a session_id, persist it
      text.split('\n').forEach(line => {
        if (line.startsWith('data:')) {
          const raw = line.replace(/^data:\s*/, '');
          try {
            const obj = JSON.parse(raw);
            if (typeof obj.session_id === 'string') {
              Onboarding.findOneAndUpdate(
                { user_id: req.user._id },
                { videoChatSessionId: obj.session_id },
                { upsert: true }
              ).catch(console.error);
            }
          } catch {/* ignore */}
        }
      });
      

      // forward the raw SSE chunk
      res.write(text);
      if (res.flush) res.flush();
    });

    upstream.data.on('end', () => {
      // close the SSE connection
      res.write('\n');
      res.end();
    });

    upstream.data.on('error', err => {
      console.error('Upstream stream error:', err);
      res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
      res.end();
    });
  } catch (err) {
    console.error('Fetch error:', err.message);
    if (!res.headersSent) {
      return res.status(err.response?.status || 502).json(err.response?.data || { message: err.message });
    }
    res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    res.end();
  }
};



const generalChatController = async (req, res) => {
  try {
    const response = await axios.post(
      `http://15.237.7.12/v3/general-chat/`,
      req.body,
      {
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
        },
      }
    );

    const newSessionId = response.data.session_id;
    if (newSessionId) {
      await Onboarding.findOneAndUpdate(
        { user_id: req.user._id },
        { generalChatSessionId: newSessionId },
        { new: true, upsert: true }
      );
    }
    const moduleId = response.data.module_id;
    if (moduleId) {
      // Query module by unique_ModuleID and populate its video field.
      const moduleDetail = await Module.findOne({ unique_ModuleID: moduleId }).populate("video");
      if (moduleDetail) {
        response.data.module_name = moduleDetail.name;
        response.data.module_object_id = moduleDetail._id; // The module's ObjectId
        response.data.channel_name = moduleDetail.video ? moduleDetail.video.channel_name : null;
      } else {
        response.data.module_name = null;
        response.data.module_object_id = null;
        response.data.channel_name = null;
      }
    }

    res.status(200).json(response.data);
  } catch (error) {
    console.error("Error calling external General Chat API:", error.message);
    if (error.response && error.response.data) {
      return res.status(error.response.status).json({
        message: "Error from General Chat API",
        error: error.response.data,
      });
    }
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

  const generalChatStreamController = async (req, res) => {
    // 1) SSE + keep‑alive headers
    res.setHeader('Content-Type',        'text/event-stream');
    res.setHeader('Cache-Control',       'no-cache');
    res.setHeader('Connection',          'keep-alive');
    // if you use compression middleware globally, disable it here
    res.setHeader('X-Accel-Buffering',   'no');      // for nginx
    req.noCompression = true;                         // for express‑compression

    res.flushHeaders();   // send headers right away

    try {
      const upstream = await axios.post(
        'http://15.237.7.12/v3/general-chat-stream/',
        req.body,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept':       'text/event-stream',
          },
          responseType: 'stream',
        }
      );

      // 2) Pipe + intercept
      upstream.data.on('data', (chunk) => {
        const text = chunk.toString();

// split out every `data:` line, JSON‑parse it, then grab .session_id
      text.split('\n').forEach(line => {
        if (line.startsWith('data:')) {
          const raw = line.replace(/^data:\s*/, '');
          try {
            const obj = JSON.parse(raw);
            if (typeof obj.session_id === 'string') {
              Onboarding.findOneAndUpdate(
                { user_id: req.user._id },
                { generalChatSessionId: obj.session_id },
                { upsert: true }
              ).catch(console.error);
            }
          } catch {/* ignore non‑JSON lines */}
        }
      });


        // forward raw chunk
        res.write(text);
        // 3) flush after each write
        if (res.flush) res.flush();
      });

      upstream.data.on('end', () => {
        res.write('\n');  // final newline
        res.end();
      });

      upstream.data.on('error', (err) => {
        console.error('Upstream error', err);
        res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
        res.end();
      });
    }
    catch (err) {
      console.error('Fetch error', err);
      if (!res.headersSent) {
        res.status(err.response?.status || 500).json(err.response?.data || { message: err.message });
      } else {
        res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
        res.end();
      }
    }
  };


const getChatHistory = async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) {
      return res.status(400).json({ error: "session_id is required" });
    }
    
    const response = await axios.get("http://15.237.7.12/v2/chat-history/", {
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
  getChatHistory,
  generalChatStreamController,
  videoChatStreamController
};
