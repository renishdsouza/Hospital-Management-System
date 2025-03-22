const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// Database Connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "hospital"
});

db.connect(err => {
    if (err) {
        console.error("Database connection failed:", err);
    } else {
        console.log("Connected to MySQL Database.");
    }
});

// Register Patient
app.post("/register", (req, res) => {
    const { name, age, phone, address, gender, email } = req.body;
    db.query("INSERT INTO patients (name, age, phone, address, gender, email) VALUES (?, ?, ?, ?, ?, ?)",
        [name, age, phone, address, gender, email],
        (err, result) => {
            if (err) {
                return res.status(500).json({ message: "Error saving patient" });
            }
            res.json({ message: "Patient registered successfully!", id: result.insertId });
        }
    );
});

// Get Patient Details
app.get("/patient/:id", (req, res) => {
    const patientId = req.params.id;
    db.query("SELECT * FROM patients WHERE id = ?", [patientId], (err, results) => {
        if (err) {
            return res.status(500).json({ message: "Database error" });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: "Patient not found" });
        }
        res.json(results[0]);
    });
});

app.listen(5000, () => console.log("Server running on port 5000"));
