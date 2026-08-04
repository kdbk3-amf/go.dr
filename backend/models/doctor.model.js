const pool = require("../config/database");

const Doctor = {

    // Get all doctors
    async getAll() {
        const result = await pool.query("SELECT * FROM doctors ORDER BY id DESC");
        return result.rows;
    },

    // Get doctor by ID
    async getById(id) {
        const result = await pool.query(
            "SELECT * FROM doctors WHERE id = $1",
            [id]
        );

        return result.rows[0];
    },

    // Create doctor
    async create(data) {
        const result = await pool.query(
            `INSERT INTO doctors
            (user_id, specialty_id, qualification, experience_years)
            VALUES ($1, $2, $3, $4)
            RETURNING *`,
            [
                data.user_id,
                data.specialty_id,
                data.qualification,
                data.experience_years
            ]
        );

        return result.rows[0];
    },

    // Update doctor
    async update(id, data) {
        const result = await pool.query(
            `UPDATE doctors
            SET qualification=$1,
                experience_years=$2
            WHERE id=$3
            RETURNING *`,
            [
                data.qualification,
                data.experience_years,
                id
            ]
        );

        return result.rows[0];
    },

    // Delete doctor
    async delete(id) {
        await pool.query(
            "DELETE FROM doctors WHERE id = $1",
            [id]
        );

        return true;
    }

};

module.exports = Doctor;
