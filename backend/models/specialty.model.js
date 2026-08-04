const pool = require("../config/database");

const Specialty = {

    // Get all specialties
    async getAll() {
        const result = await pool.query(
            "SELECT * FROM specialties ORDER BY name ASC"
        );

        return result.rows;
    },

    // Get specialty by ID
    async getById(id) {
        const result = await pool.query(
            "SELECT * FROM specialties WHERE id = $1",
            [id]
        );

        return result.rows[0];
    }

};

module.exports = Specialty;
