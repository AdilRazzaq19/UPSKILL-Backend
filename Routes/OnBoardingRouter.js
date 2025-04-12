const express = require("express");
const { createOnBoarding, retrieveData ,updateOnboarding, getAllUserProfiles} = require("../Controller/OnBoardingController");
const { authMiddleware } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/data", authMiddleware, createOnBoarding);
router.get("/retrieveData", authMiddleware, retrieveData);
router.put("/update", authMiddleware, updateOnboarding);
router.get("/getAllUserProfiles", authMiddleware, getAllUserProfiles);
module.exports = router;
