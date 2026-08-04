const Hospital = require("../models/hospital.model");

// Get all hospitals
exports.getAllHospitals = async (req, res) => {
    try {
        const hospitals = await Hospital.getAll();

        res.status(200).json({
            success: true,
            count: hospitals.length,
            data: hospitals
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get hospital by ID
exports.getHospitalById = async (req, res) => {
    try {
        const hospital = await Hospital.getById(req.params.id);

        if (!hospital) {
            return res.status(404).json({
                success: false,
                message: "Hospital not found"
            });
        }

        res.status(200).json({
            success: true,
            data: hospital
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
