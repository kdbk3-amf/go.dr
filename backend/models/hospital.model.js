const pool = require("../config/database");

const Hospital = {

    // Get all hospitals
    async getAll() {
        const result = await pool.query(
            "SELECT * FROM hospitals ORDER BY name ASC"
        );

        return result.rows;
    },

    // Get hospital by ID
    async getById(id) {
        const result = await pool.query(
            "SELECT * FROM hospitals WHERE id = $1",
            [id]
        );

        return result.rows[0];
    }

};

module.exports = Hospital;
