// routes/videoQuickReview.js
const express = require("express");
const router  = express.Router();
const {storeQuickReview}   = require("../Controller/QuickReviewController");

router.post("/statements/:video_id",storeQuickReview);

module.exports = router;
