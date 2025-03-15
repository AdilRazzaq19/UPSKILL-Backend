const express = require("express");
const { createModule, getModules, getModuleById, updateModule, deleteModule,getModulesBySectionId,getModuleDetailsByUniqueModuleId } = require("../Controller/ModuleController");
const {authMiddleware} = require("../middleware/auth.middleware");
const router = express.Router();

router.post("/create",authMiddleware, createModule);
router.get("/getAll", getModules);
router.get("/getIndividual/:module_id", getModuleById);
router.get("/getModuleBySection/:section_id",getModulesBySectionId);
router.put("/update/:id", updateModule);
router.delete("/delete/:id", deleteModule);
router.get("/getModuleByUniqueId",getModuleDetailsByUniqueModuleId);

module.exports = router;
