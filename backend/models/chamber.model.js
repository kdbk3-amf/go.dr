const pool = require("../config/database");

const Chamber = {

    // Get all chambers
    async getAll() {
        const result = await pool.query(
            "SELECT * FROM chambers ORDER BY id DESC"
        );

        return result.rows;
    },

    // Get chamber by ID
    async getById(id) {
        const result = await pool.query(
            "SELECT * FROM chambers WHERE id = $1",
            [id]
        );

        return result.rows[0];
    }

};

module.exports = Chamber;
