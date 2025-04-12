const express = require("express");
const { createModule, getModules, getModuleById, updateModule,updateModuleName, deleteModule,getModulesBySectionId,getModuleDetailsByUniqueModuleId, getAllModulesForAdmin, updateModuleforAdmin,} = require("../Controller/ModuleController");
const { authMiddleware } = require("../middleware/auth.middleware");
const router = express.Router();

router.post("/create",authMiddleware,createModule);
router.get("/getAll", getModules);
router.get("/getIndividual/:module_id", getModuleById);
router.get("/getModuleBySection/:section_id",getModulesBySectionId);
router.put("/update/:id", updateModule);
router.delete("/delete/:id", authMiddleware,deleteModule);
router.get("/getModuleByUniqueId", getModuleDetailsByUniqueModuleId);
router.put('/name-update/:moduleId', updateModuleName);
router.get("/getAllModulesForAdmin", authMiddleware,getAllModulesForAdmin);
router.put("/updateModuleforAdmin/:moduleId",authMiddleware, updateModuleforAdmin);
module.exports = router;
