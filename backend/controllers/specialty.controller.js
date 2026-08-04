const Specialty = require("../models/specialty.model");

exports.getAllSpecialties = async (req, res) => {
    try {
        const specialties = await Specialty.getAll();

        res.status(200).json({
            success: true,
            count: specialties.length,
            data: specialties
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getSpecialtyById = async (req, res) => {
    try {
        const specialty = await Specialty.getById(req.params.id);

        if (!specialty) {
            return res.status(404).json({
                success: false,
                message: "Specialty not found"
            });
        }

        res.status(200).json({
            success: true,
            data: specialty
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
