const pool = require("../config/database");

const Appointment = {

    // Get all appointments
    async getAll() {
        const result = await pool.query(
            "SELECT * FROM appointments ORDER BY appointment_date DESC, appointment_time ASC"
        );

        return result.rows;
    },

    // Get appointment by ID
    async getById(id) {
        const result = await pool.query(
            "SELECT * FROM appointments WHERE id = $1",
            [id]
        );

        return result.rows[0];
    },

    // Create appointment
    async create(data) {
        const result = await pool.query(
            `
            INSERT INTO appointments
            (
                patient_id,
                doctor_id,
                chamber_id,
                appointment_date,
                appointment_time,
                status,
                notes
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            RETURNING *
            `,
            [
                data.patient_id,
                data.doctor_id,
                data.chamber_id,
                data.appointment_date,
                data.appointment_time,
                data.status || "Pending",
                data.notes || null
            ]
        );

        return result.rows[0];
    }

};

module.exports = Appointment;
