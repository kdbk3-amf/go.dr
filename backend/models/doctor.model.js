const pool = require("../config/database");

const Doctor = {
  async getAll() {
    const result = await pool.query("SELECT * FROM doctors");
    return result.rows;
  },

  async getById(id) {
    const result = await pool.query(
      "SELECT * FROM doctors WHERE id = $1",
      [id]
    );
    return result.rows[0];
  }
};

module.exports = Doctor;
