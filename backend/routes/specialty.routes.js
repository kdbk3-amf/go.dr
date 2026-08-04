const express = require("express");
const router = express.Router();

const specialtyController = require("../controllers/specialty.controller");

// Get all specialties
router.get("/", specialtyController.getAllSpecialties);

// Get specialty by ID
router.get("/:id", specialtyController.getSpecialtyById);

module.exports = router;
