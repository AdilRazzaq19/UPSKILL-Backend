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
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');  // for nginx
  req.noCompression = true;                  // for express‑compression
  res.flushHeaders();                        // send headers right away
  
  const externalUrl = `http://15.237.7.12/v3/video-chat-stream/?video_id=${encodeURIComponent(video_id)}`;
  
  try {
    // fire off the upstream SSE request
    const upstream = await axios.post(
      externalUrl,
      req.body,
      {
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        responseType: 'stream',
      }
    );
    
    // 2) consume it as an async iterator so we can await DB calls
    for await (const chunk of upstream.data) {
      const text = chunk.toString();
      
      // parse out each `data:` line
      for (const line of text.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const raw = line.replace(/^data:\s*/, '');
        
        let obj;
        try {
          obj = JSON.parse(raw);
        } catch {
          continue;  // non‑JSON lines get ignored
        }
        
        // a) session_id persistence
        if (typeof obj.session_id === 'string') {
          Onboarding.findOneAndUpdate(
            { user_id: req.user._id },
            { videoChatSessionId: obj.session_id },
            { upsert: true }
          ).catch(console.error);
        }
        
        // b) module metadata lookup based on module_id from the stream
        if (obj.module_id) {
          console.log('Found module_id in stream:', obj.module_id);
          
          const moduleDetail = await Module
            .findOne({ unique_ModuleID: obj.module_id })
            .populate('video');
          
          const module_name = {
            module_name: moduleDetail?.name ?? null,
          };
          const module_object_id = {
            module_object_id: moduleDetail?._id ?? null,
          };
          const channel_name = {
            channel_name: moduleDetail?.video?.channel_name ?? null,
          };
          
          // emit custom SSE events
          res.write(`event: moduleName\n`);
          res.write(`data: ${JSON.stringify(module_name)}\n\n`);
          
          res.write(`event: moduleObjectId\n`);
          res.write(`data: ${JSON.stringify(module_object_id)}\n\n`);
          
          res.write(`event: channelName\n`);
          res.write(`data: ${JSON.stringify(channel_name)}\n\n`);
          if (res.flush) res.flush();
        }
      }
      
      // c) finally forward the raw tokens
      res.write(text);
      if (res.flush) res.flush();
    }
    
    // clean shutdown
    res.write('\n');
    res.end();
    
  } catch (err) {
    console.error('Stream error', err);
    if (!res.headersSent) {
      res.status(err.response?.status || 500).json(err.response?.data || { message: err.message });
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
      res.end();
    }
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

//   const generalChatStreamController = async (req, res) => {
//     // 1) SSE + keep‑alive headers
//     res.setHeader('Content-Type',        'text/event-stream');
//     res.setHeader('Cache-Control',       'no-cache');
//     res.setHeader('Connection',          'keep-alive');
//     // if you use compression middleware globally, disable it here
//     res.setHeader('X-Accel-Buffering',   'no');      // for nginx
//     req.noCompression = true;                         // for express‑compression

//     res.flushHeaders();   // send headers right away

//     try {
//       const upstream = await axios.post(
//         'http://15.237.7.12/v3/general-chat-stream/',
//         req.body,
//         {
//           headers: {
//             'Content-Type': 'application/json',
//             'Accept':       'text/event-stream',
//           },
//           responseType: 'stream',
//         }
//       );

//       // 2) Pipe + intercept
//       upstream.data.on('data', (chunk) => {
//         const text = chunk.toString();

// // split out every `data:` line, JSON‑parse it, then grab .session_id
//       text.split('\n').forEach(line => {
//         if (line.startsWith('data:')) {
//           const raw = line.replace(/^data:\s*/, '');
//           try {
//             const obj = JSON.parse(raw);
//             if (typeof obj.session_id === 'string') {
//               Onboarding.findOneAndUpdate(
//                 { user_id: req.user._id },
//                 { generalChatSessionId: obj.session_id },
//                 { upsert: true }
//               ).catch(console.error);
//             }
//           } catch {/* ignore non‑JSON lines */}
//         }
//       });


//         // forward raw chunk
//         res.write(text);
//         // 3) flush after each write
//         if (res.flush) res.flush();
//       });

//       upstream.data.on('end', () => {
//         res.write('\n');  // final newline
//         res.end();
//       });

//       upstream.data.on('error', (err) => {
//         console.error('Upstream error', err);
//         res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
//         res.end();
//       });
//     }
//     catch (err) {
//       console.error('Fetch error', err);
//       if (!res.headersSent) {
//         res.status(err.response?.status || 500).json(err.response?.data || { message: err.message });
//       } else {
//         res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
//         res.end();
//       }
//     }
//   };

const generalChatStreamController = async (req, res) => {
  // 1) SSE + keep‑alive headers
  res.setHeader('Content-Type',      'text/event-stream');
  res.setHeader('Cache-Control',     'no-cache');
  res.setHeader('Connection',        'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');  // for nginx
  req.noCompression = true;               // for express‑compression
  res.flushHeaders();    // send headers right away

  try {
    // fire off the upstream SSE request
    const upstream = await axios.post(
      'http://15.237.7.12/v3/general-chat-stream/',
      req.body,
      {
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        responseType: 'stream',
      }
    );

    // 2) consume it as an async iterator so we can await DB calls
    for await (const chunk of upstream.data) {
      const text = chunk.toString();

      // parse out each `data:` line
      for (const line of text.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const raw = line.replace(/^data:\s*/, '');

        let obj;
        try {
          obj = JSON.parse(raw);
        } catch {
          continue;  // non‑JSON lines get ignored
        }

        // a) session_id persistence
        if (typeof obj.session_id === 'string') {
          Onboarding.findOneAndUpdate(
            { user_id: req.user._id },
            { generalChatSessionId: obj.session_id },
            { upsert: true }
          ).catch(console.error);
        }

        // b) **NEW**: module metadata
        if (obj.module_id) {
          const moduleDetail = await Module
            .findOne({ unique_ModuleID: obj.module_id })
            .populate('video');

          const module_name = {
            module_name:moduleDetail?.name ?? null,

          };
          const module_object_id={
            module_object_id:moduleDetail?._id ?? null,
          }
          const channel_name={
            channel_name:moduleDetail?.video?.channel_name ?? null,

          }

          // emit a custom SSE event called "moduleMetadata"
          res.write(`event: moduleName\n`);
          res.write(`data: ${JSON.stringify(module_name)}\n\n`);

          res.write(`event: moduleObject_id\n`);
          res.write(`data: ${JSON.stringify(module_object_id)}\n\n`);

          res.write(`event: channelName\n`);
          res.write(`data: ${JSON.stringify(channel_name)}\n\n`);
          if (res.flush) res.flush();
        }
      }

      // c) finally forward the raw tokens (or whatever the upstream is sending)
      res.write(text);
      if (res.flush) res.flush();
    }

    // clean shutdown
    res.write('\n');
    res.end();
  } catch (err) {
    console.error('Stream error', err);
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
  generalChatStreamController ,
  videoChatStreamController
};
