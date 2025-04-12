const express = require("express");
const { createOnBoarding, retrieveData ,updateOnboarding, getAllUserProfiles, deleteUserAndOnboarding, updateUserProfile} = require("../Controller/OnBoardingController");
const { authMiddleware } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/data", authMiddleware, createOnBoarding);
router.get("/retrieveData", authMiddleware, retrieveData);
router.put("/update", authMiddleware, updateOnboarding);
router.get("/getAllUserProfiles", authMiddleware, getAllUserProfiles);
router.delete("/delete/:id", authMiddleware, deleteUserAndOnboarding);
router.put("/updateUserProfile", authMiddleware, updateUserProfile);
module.exports = router;
