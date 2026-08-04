const express = require("express");
const router = express.Router();

const appointmentController = require("../controllers/appointment.controller");

// Search appointments
router.get("/search", appointmentController.searchAppointments);

// Get appointments by patient
router.get("/patient/:patientId", appointmentController.getAppointmentsByPatient);

// Get appointments by doctor
router.get("/doctor/:doctorId", appointmentController.getAppointmentsByDoctor);

// Get all appointments
router.get("/", appointmentController.getAllAppointments);

// Get appointment by ID
router.get("/:id", appointmentController.getAppointmentById);

// Create appointment
router.post("/", appointmentController.createAppointment);

// Update appointment
router.put("/:id", appointmentController.updateAppointment);

// Update appointment status
router.patch("/:id/status", appointmentController.updateAppointmentStatus);

// Delete appointment
router.delete("/:id", appointmentController.deleteAppointment);

module.exports = router;
