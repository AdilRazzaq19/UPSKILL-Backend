const express = require("express");
const { getVideoDetails,getAllVideos,deleteVideo,getVideoDetailsByModuleId,updateVideoTags,
    getVideoWithQuizzes,searchModulesBySkill,updateChannelProfileImageForVideo} = require("../Controller/VideoController");
const {authMiddleware}=require("../middleware/auth.middleware")
const router = express.Router();

// Define API Routes
router.post("/get-video-details", getVideoDetails);

router.get("/getVideo", getAllVideos);
router.get("/search", searchModulesBySkill);
router.delete("/delete/:videoId",deleteVideo)
router.get("/getvideoByModuleId/:moduleId",authMiddleware,getVideoDetailsByModuleId);
router.get('/:videoId', getVideoWithQuizzes);
router.put("/update/:videoId",updateVideoTags);
router.put("/update-channel-image/:videoId", updateChannelProfileImageForVideo);

module.exports = router;
