const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Welcome to Go Dr API",
        version: "1.0.0"
    });
});

app.listen(PORT, () => {
    console.log(`Go Dr Server running on port ${PORT}`);
});
