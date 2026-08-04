const express = require("express");
const router = express.Router();

const hospitalController = require("../controllers/hospital.controller");

// Get all hospitals
router.get("/", hospitalController.getAllHospitals);

// Get hospital by ID
router.get("/:id", hospitalController.getHospitalById);

module.exports = router;
