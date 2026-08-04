const pool = require("../config/database");

const Chamber = {

    async getAll() {
        const result = await pool.query(
            "SELECT * FROM chambers ORDER BY id DESC"
        );
        return result.rows;
    },

    async getById(id) {
        const result = await pool.query(
            "SELECT * FROM chambers WHERE id=$1",
            [id]
        );
        return result.rows[0];
    },

    async create(data) {
        const result = await pool.query(
            `
            INSERT INTO chambers
            (hospital_id,name,address,city,district)
            VALUES($1,$2,$3,$4,$5)
            RETURNING *
            `,
            [
                data.hospital_id,
                data.name,
                data.address,
                data.city,
                data.district
            ]
        );

        return result.rows[0];
    },

    async update(id,data){

        const result=await pool.query(
            `
            UPDATE chambers
            SET
            hospital_id=$1,
            name=$2,
            address=$3,
            city=$4,
            district=$5
            WHERE id=$6
            RETURNING *
            `,
            [
                data.hospital_id,
                data.name,
                data.address,
                data.city,
                data.district,
                id
            ]
        );

        return result.rows[0];
    },

    async delete(id){

        await pool.query(
            "DELETE FROM chambers WHERE id=$1",
            [id]
        );

        return true;
    },

    async search(keyword){

        const result=await pool.query(
            `
            SELECT *
            FROM chambers
            WHERE
            name ILIKE $1
            OR city ILIKE $1
            OR district ILIKE $1
            ORDER BY name
            `,
            [`%${keyword}%`]
        );

        return result.rows;
    }

};

module.exports = Chamber;
