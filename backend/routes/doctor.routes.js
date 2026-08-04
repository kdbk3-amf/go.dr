const express = require("express");
const router = express.Router();

const doctorController = require("../controllers/doctor.controller");

// Get all doctors
router.get("/", doctorController.getAllDoctors);

// Get single doctor
router.get("/:id", doctorController.getDoctorById);

// Create doctor
router.post("/", doctorController.createDoctor);

// Update doctor
router.put("/:id", doctorController.updateDoctor);

// Delete doctor
router.delete("/:id", doctorController.deleteDoctor);

module.exports = router;
