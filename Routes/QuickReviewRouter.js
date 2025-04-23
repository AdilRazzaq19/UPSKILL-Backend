// routes/videoQuickReview.js
const express = require("express");
const router  = express.Router();
const {storeQuickReview,getQuickReviewStatements,storeQuickReviewScore}   = require("../Controller/QuickReviewController");
const {authMiddleware}= require("../middleware/auth.middleware");
router.post("/statements/:video_id",storeQuickReview);
router.get("/getStatements/:video_id",getQuickReviewStatements)
router.post("/updateScore",authMiddleware,storeQuickReviewScore)

module.exports = router;
