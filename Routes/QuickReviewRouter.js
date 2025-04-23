// routes/videoQuickReview.js
const express = require("express");
const router  = express.Router();
const {storeQuickReview,getQuickReviewStatements}   = require("../Controller/QuickReviewController");

router.post("/statements/:video_id",storeQuickReview);
router.get("/getStatements/:video_id",getQuickReviewStatements)

module.exports = router;
