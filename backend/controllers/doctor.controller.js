exports.getAllDoctors = async (req, res) => {
  res.status(200).json({
    success: true,
    message: "All doctors fetched successfully"
  });
};

exports.getDoctorById = async (req, res) => {
  res.status(200).json({
    success: true,
    message: "Doctor details fetched successfully"
  });
};

exports.createDoctor = async (req, res) => {
  res.status(201).json({
    success: true,
    message: "Doctor profile created successfully"
  });
};

exports.updateDoctor = async (req, res) => {
  res.status(200).json({
    success: true,
    message: "Doctor profile updated successfully"
  });
};

exports.deleteDoctor = async (req, res) => {
  res.status(200).json({
    success: true,
    message: "Doctor profile deleted successfully"
  });
};
