const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const doctorRoutes = require("./routes/doctor.routes");
const specialtyRoutes = require("./routes/specialty.routes");
const hospitalRoutes = require("./routes/hospital.routes");
const chamberRoutes=require("./routes/chamber.routes");
const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/specialties", specialtyRoutes);
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/chambers",chamberRoutes);
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to Go Dr API",
    version: "1.0.0"
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Go Dr Server running on port ${PORT}`);
});
