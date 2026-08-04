const Doctor = require("../models/doctor.model");

// Get all doctors
exports.getAllDoctors = async (req, res) => {
    try {
        const doctors = await Doctor.getAll();

        res.status(200).json({
            success: true,
            data: doctors
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get doctor by ID
exports.getDoctorById = async (req, res) => {
    try {
        const doctor = await Doctor.getById(req.params.id);

        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: "Doctor not found"
            });
        }

        res.status(200).json({
            success: true,
            data: doctor
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Create doctor
exports.createDoctor = async (req, res) => {
    res.status(201).json({
        success: true,
        message: "Doctor profile created successfully"
    });
};

// Update doctor
exports.updateDoctor = async (req, res) => {
    res.status(200).json({
        success: true,
        message: "Doctor profile updated successfully"
    });
};

// Delete doctor
exports.deleteDoctor = async (req, res) => {
    res.status(200).json({
        success: true,
        message: "Doctor profile deleted successfully"
    });
};
