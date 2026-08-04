const pool = require("../config/database");

const Doctor = {

    // Get all doctors
    async getAll() {
        const query = `
            SELECT *
            FROM doctors
            ORDER BY id DESC
        `;

        const result = await pool.query(query);
        return result.rows;
    },

    // Get doctor by ID
    async getById(id) {
        const query = `
            SELECT *
            FROM doctors
            WHERE id = $1
        `;

        const result = await pool.query(query, [id]);
        return result.rows[0];
    },

    // Create doctor
    async create(data) {
        const query = `
            INSERT INTO doctors
            (
                user_id,
                qualification,
                experience_years,
                consultation_fee,
                about,
                profile_photo
            )
            VALUES ($1,$2,$3,$4,$5,$6)
            RETURNING *
        `;

        const values = [
            data.user_id,
            data.qualification,
            data.experience_years,
            data.consultation_fee,
            data.about,
            data.profile_photo
        ];

        const result = await pool.query(query, values);

        return result.rows[0];
    },

    // Update doctor
    async update(id, data) {
        const query = `
            UPDATE doctors
            SET
                qualification = $1,
                experience_years = $2,
                consultation_fee = $3,
                about = $4,
                profile_photo = $5,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $6
            RETURNING *
        `;

        const values = [
            data.qualification,
            data.experience_years,
            data.consultation_fee,
            data.about,
            data.profile_photo,
            id
        ];

        const result = await pool.query(query, values);

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
