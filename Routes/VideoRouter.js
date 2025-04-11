const express = require("express");
const { getVideoDetails,getAllVideos,deleteVideo,getVideoDetailsByModuleId,updateVideoTags,  getTranscriptionByVideoId ,

    getVideoWithQuizzes,searchModulesBySkill,updateChannelProfileImageForVideo, getQuizzesByYoutubeVideoId, getIntroductionByYoutubeVideoId, getKeyLearningByYoutubeVideoId, getExecutiveSummaryByYoutubeVideoId } = require("../Controller/VideoController");
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
router.get('/quizzes/:youtubeVideoId', getQuizzesByYoutubeVideoId);
router.get('/introduction/:youtubeVideoId', getIntroductionByYoutubeVideoId);
router.get('/key-learning/:youtubeVideoId', getKeyLearningByYoutubeVideoId);
router.get('/executive-summary/:youtubeVideoId', getExecutiveSummaryByYoutubeVideoId);
router.get('/transcription/:video_id', getTranscriptionByVideoId);

module.exports = router;
