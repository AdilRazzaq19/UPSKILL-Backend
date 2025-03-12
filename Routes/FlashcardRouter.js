const express = require("express");
const { storeFlashcards} = require("../Controller/FlashcardController");
const router = express.Router();

router.post("/create/:video_id", storeFlashcards);  

module.exports = router;
