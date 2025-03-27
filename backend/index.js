import express from 'express';
import bodyParser from 'body-parser';
// import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");

const pool = new pg.Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

pool.connect()
    .then(() => console.log("Connected to PostgreSQL"))
    .catch(err => console.error("Database connection error", err));

//homepage
app.get('/', (req, res) => {
    res.render("login.ejs");
});

// Login Route
app.post("/login/submit", async (req, res) => {
    const { username, password, role } = req.body;
    try {
        const result = await pool.query(
            'SELECT * FROM "user" WHERE username = $1 AND password = $2 AND role = $3',
            [username, password, role]
        );

        if (result.rows.length > 0) {
            if (role === "patient") {
                let patientresult;
                try {
                    //remember postgree is case sensitive in table names if you don't use query like this
                    //'SELECT * FROM "Patient" WHERE user_id=$1' and use "SELECT * FROM Patient WHERE user_id=$1" then 
                    //patient will be converted to lowercase so it will say table doesn't exist
                    patientresult = await pool.query(
                        "SELECT * FROM patient WHERE user_id=$1",
                        [result.rows[0].user_id]
                    );
                } catch (err) {
                    console.log(err);
                    res.status(500).send("Server error");
                }
                if (patientresult.rows.length > 0)
                    res.render("patient_dashboard.ejs", { patientdata: patientresult.rows[0] });
                else
                    console.log("user entry exists but patient table entry missing");
            } else if (role === "doctor") {
                let doctorresult;
                try {
                    doctorresult = await pool.query(
                        "SELECT * FROM doctor WHERE user_id=$1",
                        [result.rows[0].user_id]
                    );
                } catch (err) {
                    console.log(err);
                    res.status(500).send("Server error");
                }
                if (doctorresult.rows.length > 0)
                    res.render("doctor_dashboard.ejs", { doctordata: doctorresult.rows[0] });
                else
                    console.log("user entry exists but doctor table entry missing");

            } else if (role === "admin") {
                let adminresult;
                try {
                    adminresult = await pool.query(
                        "SELECT * FROM admin WHERE user_id=$1",
                        [result.rows[0].user_id]
                    );
                } catch (err) {
                    console.log(err);
                    res.status(500).send("Server error");
                }
                if (adminresult.rows.length > 0)
                    res.render("admin_dashboard.ejs", { admindata: adminresult.rows[0] });
                else
                    console.log("user entry exists but admin table entry missing");
            } else {
                let receptionistresult;
                try {
                    receptionistresult = await pool.query(
                        "SELECT * FROM receptionist WHERE user_id=$1",
                        [result.rows[0].user_id]
                    );
                } catch (err) {
                    console.log(err);
                    res.status(500).send("Server error");
                }
                if (receptionistresult.rows.length > 0)
                    res.render("reception_dashboard.ejs", { receptionnistdata: receptionistresult.rows[0] });
                else
                    console.log("user entry exists but reception table entry missing");
            }
        } else {
            res.render("login.ejs", { status: "false" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

//reception new patient register button action
app.post("/reception/newpatienregister", async (req, res) => {
    res.render("new_patient_register.ejs", { receptionnistdatasent: req.body });
});

//new patient registeration page action
app.post("/new/patient/register/submit", async (req, res) => {
    const { receptionnistdatasent, username, password, name, dob, gender, phone, email, address, bloodgroup, medical_history } = req.body;
    //here we can do this without reconnecting but we have to create a new connection if we want it to be like a transaction
    //begin indicates start of transaction and if there is any issue in the transaction then we will use roll
    //back to cancel the transaction and not make any changes
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        //user table insert first
        const userInsertQuery = 'INSERT INTO "user" (username, password, role) VALUES ($1, $2, $3) RETURNING user_id';
        const userResult = await client.query(userInsertQuery, [username, password, "patient"]);
        const userId = userResult.rows[0].user_id;

        //patient table insert
        const patientInsertQuery = "INSERT INTO patient (user_id, name, dob, gender, phone, email, address, bloodgroup, medical_history) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)";
        await client.query(patientInsertQuery, [userId, name, dob, gender, phone, email, address, bloodgroup, medical_history]);

        await client.query("COMMIT");
        res.render("reception_dashboard.ejs", { receptionnistdata: receptionnistdatasent, newpatientregisterstatus: "true" });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Transaction failed:", error);
        res.render("reception_dashboard.ejs", { receptionnistdata: receptionnistdatasent, newpatientregisterstatus: "false" });
    } finally {
        client.release();
    }
});

//logout
app.get("/logout", (req, res) => {
    res.redirect("/");
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
