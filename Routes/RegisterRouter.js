const express = require("express");
const { RegisterAdmin, RegisterUser, updateUserName, updateAdminName} = require("../Controller/RegisterController");
const {authMiddleware}=require("../middleware/auth.middleware")
const router = express.Router();

router.post("/admin", RegisterAdmin);
router.post("/user", RegisterUser);
router.put("/updateUser",authMiddleware,updateUserName);
router.put("/updateAdmimName",authMiddleware,updateAdminName); 


module.exports = router;
