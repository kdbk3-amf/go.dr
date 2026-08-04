const express = require("express");
const router = express.Router();

const appointmentController = require("../controllers/appointment.controller");

router.get("/", appointmentController.getAllAppointments);

router.get("/:id", appointmentController.getAppointmentById);

router.post("/", appointmentController.createAppointment);

module.exports = router;
