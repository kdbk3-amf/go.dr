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

// Search hospitals
async search(searchTerm) {
    const result = await pool.query(
        `
        SELECT *
        FROM hospitals
        WHERE
            name ILIKE $1
            OR city ILIKE $1
            OR district ILIKE $1
        ORDER BY name ASC
        `,
        [`%${searchTerm}%`]
    );

    return result.rows;
}
module.exports = Hospital;
