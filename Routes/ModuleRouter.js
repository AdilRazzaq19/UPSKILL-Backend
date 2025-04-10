const express = require("express");
const { createModule, getModules, getModuleById, updateModule,updateModuleName, deleteModule,getModulesBySectionId,getModuleDetailsByUniqueModuleId, getAllModulesForAdmin, updateModuleforAdmin,} = require("../Controller/ModuleController");
const router = express.Router();

router.post("/create",createModule);
router.get("/getAll", getModules);
router.get("/getIndividual/:module_id", getModuleById);
router.get("/getModuleBySection/:section_id",getModulesBySectionId);
router.put("/update/:id", updateModule);
router.delete("/delete/:id", deleteModule);
router.get("/getModuleByUniqueId", getModuleDetailsByUniqueModuleId);
router.put('/name-update/:moduleId', updateModuleName);
router.get("/getAllModulesForAdmin", getAllModulesForAdmin);
router.put("/updateModuleforAdmin/:moduleId", updateModuleforAdmin);
module.exports = router;
