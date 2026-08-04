const pool = require("../config/database");

const Appointment = {

    // Get all appointments
    async getAll() {
        const result = await pool.query(
            `
            SELECT *
            FROM appointments
            ORDER BY appointment_date DESC, appointment_time ASC
            `
        );

        return result.rows;
    },

    // Get appointment by ID
    async getById(id) {
        const result = await pool.query(
            `
            SELECT *
            FROM appointments
            WHERE id = $1
            `,
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
    },

    // Update appointment
    async update(id, data) {
        const result = await pool.query(
            `
            UPDATE appointments
            SET
                appointment_date = $1,
                appointment_time = $2,
                status = $3,
                notes = $4
            WHERE id = $5
            RETURNING *
            `,
            [
                data.appointment_date,
                data.appointment_time,
                data.status,
                data.notes,
                id
            ]
        );

        return result.rows[0];
    },

    // Delete appointment
    async delete(id) {
        await pool.query(
            `
            DELETE FROM appointments
            WHERE id = $1
            `,
            [id]
        );

        return true;
    },

    // Update appointment status
    async updateStatus(id, status) {
        const result = await pool.query(
            `
            UPDATE appointments
            SET status = $1
            WHERE id = $2
            RETURNING *
            `,
            [status, id]
        );

        return result.rows[0];
    },

    // Get appointments by patient
    async getByPatient(patientId) {
        const result = await pool.query(
            `
            SELECT *
            FROM appointments
            WHERE patient_id = $1
            ORDER BY appointment_date DESC, appointment_time DESC
            `,
            [patientId]
        );

        return result.rows;
    },

    // Get appointments by doctor
    async getByDoctor(doctorId) {
        const result = await pool.query(
            `
            SELECT *
            FROM appointments
            WHERE doctor_id = $1
            ORDER BY appointment_date DESC, appointment_time DESC
            `,
            [doctorId]
        );

        return result.rows;
    },

    // Search appointments
    async search(keyword) {
        const result = await pool.query(
            `
            SELECT *
            FROM appointments
            WHERE
                CAST(patient_id AS TEXT) ILIKE $1
                OR CAST(doctor_id AS TEXT) ILIKE $1
                OR status ILIKE $1
            ORDER BY appointment_date DESC
            `,
            [`%${keyword}%`]
        );

        return result.rows;
    },

    // Get upcoming appointments
    async getUpcoming() {
        const result = await pool.query(
            `
            SELECT *
            FROM appointments
            WHERE appointment_date >= CURRENT_DATE
            ORDER BY appointment_date ASC, appointment_time ASC
            `
        );

        return result.rows;
    },

    // Get appointment history
    async getHistory() {
        const result = await pool.query(
            `
            SELECT *
            FROM appointments
            WHERE appointment_date < CURRENT_DATE
            ORDER BY appointment_date DESC, appointment_time DESC
            `
        );

        return result.rows;
    }

};

module.exports = Appointment;
