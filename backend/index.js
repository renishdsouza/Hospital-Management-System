import express from 'express';
import bodyParser from 'body-parser';//not needed try default does node stream parse
// import cors from 'cors'; //When using react diff port cross origin resource sharing
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

dotenv.config();

const saltRounds = parseInt(process.env.BCRYPT_ROUNDS);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));//uses qs library obj in obj for []
app.use(express.json()); // For JSON data
app.use(express.static('public'));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

const pool = new pg.Pool({ //default 100 connections
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

pool.connect()
    .then(() => console.log("Connected to PostgreSQL"))
    .catch(err => console.error("Database connection error", err));

//homepage rendering
app.get('/', async (req, res) => {
    res.render("login.ejs");
});
//on all dashboard add a logout button
// Login Route
app.post("/login/submit", async (req, res) => {
    const { username, password, role } = req.body;

    try {
        if(typeof password === "string" && password.length < 70){

        }
        else{
            return res.render("login.ejs", { status: "false" });
        }
        const result = await pool.query(
            'SELECT * FROM "user" WHERE username = $1  AND role = $2',
            [username, role]
        );

console.log(password,result.rows[0].password);
        let pwdcorrect = await bcrypt.compare(password , result.rows[0].password);
        if (result.rows.length === 0 || !pwdcorrect) {
            return res.render("login.ejs", { status: "false" });
        }

        const user_id = result.rows[0].user_id;

        let query = "";
        let roleData = {};
        let dashboardView = "";

        if (role === "patient") {
            query = 'SELECT * FROM "patient" WHERE user_id=$1';
            dashboardView = "patient_dashboard.ejs";
        } else if (role === "doctor") {
            query = 'SELECT * FROM "doctor" WHERE user_id=$1';
            dashboardView = "doctor_dashboard.ejs";
        } else if (role === "admin") {
            query = 'SELECT * FROM "admin" WHERE user_id=$1';
            dashboardView = "admin_dashboard.ejs";
        } else if (role === "receptionist") {
            query = 'SELECT * FROM "receptionist" WHERE user_id=$1';
            dashboardView = "reception_dashboard.ejs";
        } else {
            return res.status(400).send("Invalid role selected.");
        }

        const roleResult = await pool.query(query, [user_id]);

        if (roleResult.rows.length === 0) {
            console.log(`User entry exists but ${role} table entry is missing`);
            return res.status(404).send(`${role} data not found`);
        }

        roleData = roleResult.rows[0];

        //  Ensure correct variable names are passed based on role
        if (role === "patient") {
            return res.render(dashboardView, {
                patientdata: roleData
            });
        } else if (role === "doctor") {
            return res.render(dashboardView, { doctordata: roleData });
        } else if (role === "admin") {
            return res.render(dashboardView, { admindata: roleData });
        } else if (role === "receptionist") {
            return res.render(dashboardView, { receptionistdata: roleData });
        }

    } catch (err) {
        console.error("Error during login:", err);
        res.status(500).send("Server error");
    }
});

//reception new patient register button action
// Reception New Patient Register Button Action
app.post("/reception/newpatienregister", async (req, res) => {
    let receptionistdata = req.body.receptionistdata;

    try {
        // Parse receptionistdata if it's a JSON string
        receptionistdata = typeof receptionistdata === "string" ? JSON.parse(receptionistdata) : receptionistdata;
    } catch (error) {
        console.error("Error parsing receptionistdata:", error);
        receptionistdata = {}; // Default to an empty object if parsing fails
    }

    res.render("new_patient_register.ejs", { receptionistdata });
});

// New Patient Registration Page Action
// New Patient Registration Page Action
app.post("/new/patient/register/submit", async (req, res) => {
    let { receptionistdata, username, password, name, dob, gender, phone, email, address, bloodgroup, medical_history } = req.body;
    console.log("New patient dob:",dob);
    try {
        // Parse receptionistdata if it's a JSON string
        receptionistdata = typeof receptionistdata === "string" ? JSON.parse(receptionistdata) : receptionistdata;
    } catch (error) {
        console.error("Error parsing receptionistdata:", error);
        return res.render("reception_dashboard.ejs", { receptionistdata: {}, newpatientregisterstatus: "false" });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Insert into user table first
        const userInsertQuery =
            'INSERT INTO "user" (username, password, role) VALUES ($1, $2, $3) RETURNING user_id';
        const userResult = await client.query(userInsertQuery, [username, password, "patient"]);
        const userId = userResult.rows[0].user_id;

        // Insert into patient table
        const patientInsertQuery =
            'INSERT INTO "patient" (user_id, name, dob, gender, phone, email, address, blood_group, medical_history) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)';
        await client.query(patientInsertQuery, [
            userId,
            name,
            dob,
            gender,
            phone,
            email,
            address,
            bloodgroup || null,
            medical_history || null,
        ]);

        await client.query("COMMIT");

        res.render("reception_dashboard.ejs", { receptionistdata: receptionistdata || {}, newpatientregisterstatus: "true" });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Transaction failed:", error);
        res.render("reception_dashboard.ejs", { receptionistdata: receptionistdata || {}, newpatientregisterstatus: "false" });
    } finally {
        client.release();
    }
});

//first appionments stage 1 page
app.post("/appoinment/reception/schedule", (req, res) => {
    let receptionistdata = req.body.receptionistdata;

    // Parse receptionistdata if it's a JSON string
    try {
        receptionistdata = JSON.parse(receptionistdata);
    } catch (error) {
        console.error("Error parsing receptionistdata:", error);
    }

    res.render("first_appointment_stage_1.ejs", { receptionistdata });
});

//appoinment schedule receptionnist stage1
app.post("/new/appoinment/schedule/reception/stage1", async (req, res) => {
    let { receptionistdata, dob, username } = req.body;
    console.log("Patient dob for appointmetn scheduling:",dob);
    // Ensure receptionistdata is already an object
    try {
        receptionistdata = typeof receptionistdata === "string" ? JSON.parse(receptionistdata) : receptionistdata;
    } catch (error) {
        console.error("Error parsing receptionistdata:", error);
        receptionistdata = {}; // Fallback to empty object
    }

    try {
        const resultuser = await pool.query('SELECT * FROM "user" WHERE username=$1', [username]);
        if (resultuser.rows.length > 0) {
            const userid = resultuser.rows[0].user_id;
            const patientquerresult = await pool.query("SELECT * FROM patient WHERE user_id=$1 AND dob=$2", [userid, dob]);

            if (patientquerresult.rows.length > 0) {
                const patientdetails = patientquerresult.rows[0];
                patientdetails.age = calculateAge(patientdetails.dob); // Add age based on DOB

                res.render("appointment_scheduler_page_stage2.ejs", { receptionistdata, patientdetails });
            } else {
                res.render("reception_dashboard.ejs", { receptionistdata, patientfound: "false" });
            }
        } else {
            res.render("reception_dashboard.ejs", { receptionistdata, patientfound: "false" });
        }
    } catch (error) {
        console.error("Error in appointment scheduler patient search:", error);
    }
});

// Helper function to calculate age from DOB
function calculateAge(dob) {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}




// appoinment schedule,stage 2 to stage 3 send logic now below is  stage 2 we have to confirm the patient details
app.post("/new/appointment/schedule/reception/stage2/confirm", async (req, res) => {
    let { patientdetails, receptionistdata } = req.body;

    // Ensure receptionistdata and patientdetails are objects
    try {
        receptionistdata = typeof receptionistdata === "string" ? JSON.parse(receptionistdata) : receptionistdata;
        patientdetails = typeof patientdetails === "string" ? JSON.parse(patientdetails) : patientdetails;
    } catch (error) {
        console.error("Error parsing data:", error);
        // Fallback to empty objects if parsing fails
        receptionistdata = {};
        patientdetails = {};
    }

    try {
        const { rows: doctorspecialization } = await pool.query("SELECT DISTINCT specialization FROM doctor");

        res.render("appointment_scheduler_page_stage3.ejs", {
            patientdata: patientdetails || {}, // Pass patient details
            receptionistdata: receptionistdata || {}, // Pass receptionist data
            specialization: doctorspecialization, // Pass specialization as an array of objects
            doctors: undefined, // Initialize doctors as undefined
        });
    } catch (error) {
        console.error("Unable to get doctor specialization:", error);
    }
});





//appoinment schedule stage 3 here patien will have to choose a specialization this needs to be a 
//separate form in html where upon selecting a option i will get a method=post and action as
// the path specified down /new/appoinmets/....
app.post("/new/appointment/schedule/reception/stage3/specialization", async (req, res) => {
    let { patientdata, receptionistdata, chosen_specialization } = req.body;

    // Ensure patientdata and receptionistdata are objects
    try {
        patientdata = typeof patientdata === "string" ? JSON.parse(patientdata) : patientdata;
        receptionistdata = typeof receptionistdata === "string" ? JSON.parse(receptionistdata) : receptionistdata;
    } catch (error) {
        console.error("Error parsing data:", error);
        // Fallback to empty objects if parsing fails
        patientdata = {};
        receptionistdata = {};
    }

    console.log("Chosen Specialization:", chosen_specialization); // Debugging log

    try {
        const { rows: doctorqueryresult } = await pool.query("SELECT * FROM doctor WHERE specialization=$1", [chosen_specialization]);
        // console.log("Patient Data:", patientdata);

        res.render("appointment_scheduler_page_stage3.ejs", {
            patientdata,
            receptionistdata,
            doctors: doctorqueryresult, // Pass fetched doctors directly as an array
            chosen_specialization,
            specialization: [] // Pass an empty array if needed
        });
    } catch (error) {
        console.error("Error in appointment scheduler stage 3:", error);

        res.render("appointment_scheduler_page_stage3.ejs", {
            patientdata,
            receptionistdata,
            doctors: [], // Empty array for doctors
            chosen_specialization,
            specialization: []
        });
    }
});



//but we need to ensure doctor names are unique at present within the same specialization
//after choosing doctor date and time the second will have this within the same page
app.post("/add/appointment", async (req, res) => {
    let { patientdata, receptionistdata, selected_doctor_name, chosen_specialization, date, time } = req.body;

    try {
        // Parse JSON strings if necessary
        patientdata = typeof patientdata === "string" ? JSON.parse(patientdata) : patientdata;
        receptionistdata = typeof receptionistdata === "string" ? JSON.parse(receptionistdata) : receptionistdata;

        console.log("Received date:", date); // Debugging

        // Ensure date is formatted correctly
        const formattedDate = new Date(date).toISOString().split("T")[0]; // Convert to YYYY-MM-DD

        const doctorqueryresult = await pool.query(
            "SELECT * FROM doctor WHERE specialization=$1 AND name=$2",
            [chosen_specialization, selected_doctor_name]
        );

        if (doctorqueryresult.rows.length > 0) {
            const doctorid = doctorqueryresult.rows[0].doctor_id;
            const client = await pool.connect();
            try {
                await client.query("BEGIN");
                const appointmentInsertQuery =
                    "INSERT INTO appointment (doctor_id, patient_id, date, time) VALUES ($1, $2, $3::DATE, $4::TIME)";
                await client.query(appointmentInsertQuery, [doctorid, patientdata.patient_id, formattedDate, time]);
                await client.query("COMMIT");
                res.render("success_appointment_schedule_reception.ejs", { receptionistdata });
            } catch (error) {
                await client.query("ROLLBACK");
                console.error("Transaction failed:", error);
                res.render("failed_appointment_schedule_reception.ejs", { receptionistdata });
            } finally {
                client.release();
            }
        } else {
            console.error("No matching doctor found.");
            res.render("failed_appointment_schedule_reception.ejs", { receptionistdata });
        }
    } catch (error) {
        console.error("Error in appointment scheduler:", error);
    }
});



//appointment success
app.get("/new/appointment/schedule/reception/stage4", async (req, res) => {
    let { receptionistdata } = req.query; // Use query parameters instead of req.body for GET requests
    console.log("hi");
    console.log(receptionistdata);
    // Parse receptionistdata if it's a JSON string
    try {
        receptionistdata = typeof receptionistdata === "string" ? JSON.parse(receptionistdata) : receptionistdata;
    } catch (error) {
        console.error("Error parsing receptionistdata:", error);
        receptionistdata = {}; // Fallback to empty object if parsing fails
    }

    res.render("success_appointment_schedule_reception.ejs", { receptionistdata });
});




//appointment failed
app.get("/new/appointment/reception/failed", async (req, res) => {
    let { receptionistdata } = req.query; // Use query parameters instead of req.body for GET requests

    // Parse receptionistdata if it's a JSON string
    try {
        receptionistdata = typeof receptionistdata === "string" ? JSON.parse(receptionistdata) : receptionistdata;
    } catch (error) {
        console.error("Error parsing receptionistdata:", error);
        receptionistdata = {}; // Fallback to empty object if parsing fails
    }

    res.render("failed_appointment_schedule_reception.ejs", { receptionistdata });
});





// Receptionist Dashboard
app.get("/reception/dashboard", async (req, res) => {
    let { receptionistdata } = req.query; // Use query parameters instead of req.body for GET requests

    // Parse receptionistdata if it's a JSON string
    try {
        receptionistdata = typeof receptionistdata === "string" ? JSON.parse(receptionistdata) : receptionistdata;
    } catch (error) {
        console.error("Error parsing receptionistdata:", error);
        receptionistdata = {}; // Fallback to empty object if parsing fails
    }

    res.render("reception_dashboard.ejs", { receptionistdata });
});





// in patients page view appointments
app.post("/patient/appointment", async (req, res) => {
    let patientdata;

    try {
        patientdata = JSON.parse(req.body.patientdata); // Parse JSON string
    } catch (error) {
        console.error("Error parsing patient data:", error);
        return res.status(400).json({ error: "Invalid patient data format" });
    }

    if (!patientdata || !patientdata.patient_id) {
        return res.status(400).json({ error: "Invalid patient data" });
    }

    try {
        let patientAppointmentsResult = await pool.query(
            "SELECT a.appointment_id, TO_CHAR(a.date::DATE, 'YYYY-MM-DD') AS appointment_date, a.time::TIME AS appointment_time, a.status, d.name AS doctor_name, d.specialization " +
            "FROM appointment a JOIN doctor d ON a.doctor_id = d.doctor_id " +
            "WHERE a.patient_id = $1 ORDER BY a.date DESC",
            [patientdata.patient_id]
        );

        const appointments = patientAppointmentsResult.rows;
        console.log(appointments);

        res.render("patient_view_appointment_page.ejs", {
            patientdata,
            appointments,
            noAppointments: appointments.length === 0,
        });
    } catch (err) {
        console.error("Error in patient view appointment page", err);
        res.status(500).json({ error: "Server error" });
    }
});





// in patients page add another option to view all medical records
app.post("/patients/medical/records", async (req, res) => {
    try {
        if (!req.body.patientdata) {
            return res.status(400).send("Invalid patient data");
        }
        let patientdata;
        
        try {
            patientdata = JSON.parse(req.body.patientdata);
        } catch (error) {
            return res.status(400).send("Invalid patient data format");
        }

        if (!patientdata || !patientdata.patient_id) {
            return res.status(400).send("Patient ID is missing");
        }

        // Fetch medical records using patient.patient_id
        const query = `SELECT mr.*, d.name AS doctor_name 
    FROM medicalrecords mr 
    LEFT JOIN doctor d ON mr.doctor_id = d.doctor_id 
    WHERE mr.patient_id = $1 
    ORDER BY mr.visit_date DESC;`;
        const { rows: medicalRecords } = await pool.query(query, [patientdata.patient_id]);

        res.render("patient_view_medical_record_page.ejs", {
            patientdata,
            medicalrecords: JSON.stringify(medicalRecords)
        });
    } catch (error) {
        res.status(500).send("Server error");
    }
});






// go back to dashboard patient
app.post("/patients/dashboard", (req, res) => {
    try {
        let patientdata = req.body.patientdata || "{}";
        patientdata = JSON.parse(patientdata); // Always decode
        res.render("patient_dashboard", { patientdata });
    } catch (error) {
        console.error("Error loading patient dashboard:", error);
        res.status(400).send("Invalid data format");
    }
});



//doctor dashboard view appointments button

// Doctor Dashboard View Appointments Button
app.post("/doctor/dashboard/appointments", async (req, res) => {
    let { doctordata } = req.body;
    try {
        doctordata = typeof doctordata === "string" ? JSON.parse(doctordata) : doctordata;
        res.render("doctor_appointment_view_date_selector.ejs", { doctordata });
    } catch (error) {
        console.error("Error parsing doctordata:", error);
        res.status(400).send("Invalid data format");
    }
});

// Allow option to choose a date and display appointments
app.post("/doctor/dashboard/appointments/date", async (req, res) => {
    let { doctordata, date } = req.body;

    try {
        // Parse stringified doctordata
        doctordata = typeof doctordata === "string" ? JSON.parse(doctordata) : doctordata;

        console.log("Parsed doctordata:", doctordata); // Debugging
        console.log("Selected date:", date); // Debugging

        // Ensure date is formatted correctly
        const formattedDate = new Date(date).toISOString().split("T")[0]; // Convert to YYYY-MM-DD

        const doctorAppointmentsResult = await pool.query(
            "SELECT appointment.*, TO_CHAR(appointment.date, 'YYYY-MM-DD') AS appointment_date, TO_CHAR(appointment.time, 'HH24:MI') AS appointment_time, " +
            "patient.patient_id, patient.name AS patient_name, patient.dob AS patient_dob " +
            "FROM appointment " +
            "JOIN patient ON appointment.patient_id = patient.patient_id " +
            "WHERE appointment.doctor_id = $1 AND appointment.date = $2",
            [doctordata.doctor_id, formattedDate]
        );

        console.log("Query result:", doctorAppointmentsResult.rows); // Debugging

        res.render("doctor_display_appointments.ejs", {
            doctordata,
            appointmentsData: doctorAppointmentsResult.rows,
            date: formattedDate,
        });
    } catch (error) {
        console.error("Error in doctor view appointments page:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Direct Button from Doctor Dashboard to Choose a Date for Updating Appointment Status
app.post("/doctor/dashboard/appointments/update", async (req, res) => {
    let { doctordata } = req.body;
    try {
        doctordata = typeof doctordata === "string" ? JSON.parse(doctordata) : doctordata;
        res.render("update_appointment_date_selector.ejs", { doctordata });
    } catch (error) {
        console.error("Error parsing doctordata:", error);
        res.status(400).send("Invalid data format");
    }
});

// After Choosing a Date, Display Appointments for that Date to Update Status
app.post("/doctor/dashboard/appointments/update/date", async (req, res) => {
    let { doctordata, date } = req.body; // Use let for variables that may be reassigned

    try {
        // Parse doctordata if it's a string
        doctordata = typeof doctordata === "string" ? JSON.parse(doctordata) : doctordata;

        const doctorAppointmentsResult = await pool.query(
            `SELECT appointment.*, 
                    patient.name AS patient_name, 
                    patient.dob AS patient_dob, 
                    "user".username AS patient_username 
             FROM appointment 
             JOIN patient ON appointment.patient_id = patient.patient_id 
             JOIN "user" ON patient.user_id = "user".user_id 
             WHERE appointment.doctor_id = $1 AND appointment.date = $2`,
            [doctordata.doctor_id, date]
        );

        // Render the page with fetched appointments
        res.render("appointment_status_update.ejs", {
            doctordata,
            appointmentdata: doctorAppointmentsResult.rows,
            date,
        });
    } catch (error) {
        console.error("Error in fetching appointments for updating status:", error);
        res.status(500).send("Internal Server Error");
    }
});


// Update Appointment Status Page
app.post("/doctor/dashboard/appointments/update/status", async (req, res) => {
    let { doctordata, date, patient_username, status } = req.body;

    try {
        // Parse doctordata if necessary
        doctordata = typeof doctordata === "string" ? JSON.parse(doctordata) : doctordata;

        // Fetch patient ID using username
        const patientResult = await pool.query(
            'SELECT patient_id FROM "user" JOIN patient ON "user".user_id = patient.user_id WHERE username = $1',
            [patient_username]
        );

        if (patientResult.rows.length === 0) throw new Error("Patient not found");

        const patientId = patientResult.rows[0].patient_id;

        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            // Update appointment status
            const updateQuery = `
                UPDATE appointment 
                SET status = $1 
                WHERE patient_id = $2 AND doctor_id = $3 AND date = $4
            `;
            await client.query(updateQuery, [status, patientId, doctordata.doctor_id, date]);

            await client.query("COMMIT");

            // Redirect back to the dashboard with a success message
            res.render("doctor_dashboard.ejs", { doctordata, appointmentstatus: "updated" });
        } catch (error) {
            await client.query("ROLLBACK");

            console.error("Error in updating appointment status:", error);

            // Redirect back to the dashboard with a failure message
            res.render("doctor_dashboard.ejs", { doctordata, appointmentstatus: "failed" });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Error in finding patient ID while updating appointment:", error);
        res.status(500).send("Internal Server Error");
    }
});



// Add Medical Record Button Functionality
app.post("/doctor/dashboard/appointments/medicalrecord", async (req, res) => {
    let { doctordata } = req.body;

    try {
        doctordata = typeof doctordata === "string" ? JSON.parse(doctordata) : doctordata;
        console.log("Post button press parsed:",doctordata);
        res.render("date_choose_medical_record.ejs", { doctordata });
    } catch (error) {
        console.error("Error parsing doctordata:", error);
        res.status(400).send("Invalid data format");
    }
});

//appointment fetcher for medical records after choosing date
app.post("/doctor/dashboard/appointments/date/medicalrecord", async (req, res) => {
    let { doctordata, date } = req.body;

    try {
        // Parse doctordata if necessary
        doctordata = typeof doctordata === "string" ? JSON.parse(doctordata) : doctordata;
        console.log("Pre appointment fetch:",doctordata);
        console.log("chosendate:",date);
        // Query to fetch appointments for the selected date
        const doctorAppointmentsResult = await pool.query(
            `SELECT appointment.appointment_id, 
                    TO_CHAR(appointment.date, 'YYYY-MM-DD') AS appointment_date,
                    TO_CHAR(appointment.time, 'HH24:MI') AS appointment_time,
                    patient.patient_id,
                    patient.name AS patient_name,
                    patient.dob AS patient_dob,
                    "user".username AS patient_username,
                    appointment.status
             FROM appointment
             JOIN patient ON appointment.patient_id = patient.patient_id
             JOIN "user" ON patient.user_id = "user".user_id
             WHERE appointment.doctor_id = $1 AND appointment.date = $2`,
            [doctordata.doctor_id, date]
        );

        // Render the page with appointments data
        res.render("add_medical_record_page.ejs", {
            doctordata,
            appointmentsData: doctorAppointmentsResult.rows,
            date,
        });
    } catch (error) {
        console.error("Error fetching appointments:", error);
        res.status(500).send("Internal Server Error");
    }
});



// Add Medical Records Functionality
app.post("/doctor/dashboard/appointments/medicalrecord/add", async (req, res) => {
    let { doctordata, patient_id, diagnosis, prescription, appointment_id } = req.body;
        doctordata=JSON.parse(doctordata);
        console.log("doctordata pre insertion:",doctordata);
    try {
        
        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            // Insert medical record into the database
            await client.query(
                `INSERT INTO medicalrecords (patient_id, doctor_id, diagnosis, prescription, appointment_id)
                 VALUES ($1, $2, $3, $4, $5)`,
                [patient_id, doctordata.doctor_id, diagnosis || null, prescription || null, appointment_id]
            );

            await client.query("COMMIT");

            res.render("medical_record_added_page.ejs", { doctordata });
        } catch (error) {
            await client.query("ROLLBACK");
            console.error("Error adding medical record:", error);
            res.render("medical_record_add_fail.ejs", { doctordata });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Error adding medical record:", error);
        res.status(500).send("Internal Server Error");
    }
});



// Go Back to Doctor Dashboard Button
app.post("/doctor/dashboard", async (req, res) => {
    let { doctordata } = req.body;

    try {
        // Parse doctordata if necessary
        doctordata = typeof doctordata === "string" ? JSON.parse(doctordata) : doctordata;

        res.render("doctor_dashboard.ejs", { doctordata });
    } catch (error) {
        console.error("Error loading doctor dashboard:", error);
        res.status(400).send("Invalid data format");
    }
});







//admin add new user button functionality
app.post("/admin/dashboard/users/add",async (req,res)=>{
    const{admindata}=req.body;
    res.render("add_user_page.ejs",{admindata,useralreadypresent:"false"});
});
//admin add  new user page here there will be next button upon clicking that request will come to below
app.post("/admin/add/new/user/stage1",async (req,res)=>{
    //username password and role 
    let {admindata,username,password,role}=req.body;
    admindata=JSON.parse(admindata);
    //here we are checking if the username is already taken
   let usercheck= await pool.query('SELECT * FROM "user" WHERE username = $1',[username]);
   console.log(usercheck);
   if(usercheck.rows.length>0)
        res.render("add_user_page.ejs",{admindata, useralreadypresent:"true"});
    else{
    
        const client = await pool.connect();
    try {
        await client.query("BEGIN");
        //user table insert first
        const userInsertQuery = 'INSERT INTO "user" (username, password, role) VALUES ($1, $2, $3) RETURNING user_id';
        const userResult = await client.query(userInsertQuery, [username, password, role]);
        const userId = userResult.rows[0].user_id;
        await client.query("COMMIT");
        if(role=="patient")
            res.render("add_patient_page.ejs",{admindata,userid:userId});
        else if(role=="doctor")
                res.render("add_doctor_page.ejs",{admindata,userid:userId});
            else
            res.render("add_receptionist_page.ejs",{admindata,userid:userId});


    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Transaction failed:", error);
        console.log("unable to add into user table by admin");
        await client.query("ROLLBACK");
    } finally {
        client.release();
    }
    }
});
//new patient add by admin
app.post("/admin/add/new/patient/stage2",async (req,res)=>{
    let {admindata,userid,name, dob, gender, phone, email, address, bloodgroup, medical_history}=req.body;
    admindata=JSON.parse(admindata);
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const patientInsertQuery = 'INSERT INTO "patient" (user_id, name, dob, gender, phone, email, address, blood_group, medical_history) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)';
        await client.query(patientInsertQuery, [userid, name, dob, gender, phone, email, address, bloodgroup, medical_history]);
        await client.query("COMMIT");
        //this page must contain a button to go back to dashboard
        res.render("successfully_added_admin.ejs",{admindata});
    } catch(error){
        console.log("unable to add into patient table by admin");
        console.log(error);
        await client.query("ROLLBACK");
        //deleting user table entry also
        await client.query('DELETE FROM "user" WHERE user_id = $1', [userid]);
        //also add go back to dashboard button
        res.render("failed_to_add_by_admin.ejs",{admindata});
    }finally{
        client.release();
    }

});
//new doctor add by admin
app.post("/admin/add/new/doctor/stage2",async (req,res)=>{
    let {admindata,userid,name,specialization,phone,email,availability}=req.body;
    admindata=JSON.parse(admindata);
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const doctorInsertQuery = 'INSERT INTO "doctor" (user_id, name, phone, email,specialization,availability) VALUES ($1,$2,$3,$4,$5,$6)';
        await client.query(doctorInsertQuery, [userid, name,phone,email,specialization,availability]);
        await client.query("COMMIT");
        res.render("successfully_added_admin.ejs",{admindata});
    } catch(error){
        console.log(error);
        console.log("unable to add into doctor table by admin");
        await client.query("ROLLBACK");
        await client.query('DELETE FROM "user" WHERE user_id = $1', [userid]);
        res.render("failed_to_add_by_admin.ejs",{admindata});
    }finally{
        client.release();
    }
});
//new receptionist add by admin
app.post("/admin/add/new/receptionist/stage2",async (req,res)=>{
    let {admindata,userid,name,phone,email}=req.body;
    admindata=JSON.parse(admindata);
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const receptionInsertQuery = 'INSERT INTO "receptionist" (user_id, name, phone, email) VALUES ($1,$2,$3,$4)';
        await client.query(receptionInsertQuery, [userid, name,phone,email]);
        await client.query("COMMIT");
        res.render("successfully_added_admin.ejs",{admindata});
        }catch(error){
            console.log("unable to add into receptionist table by admin");
            await client.query("ROLLBACK");
            await client.query('DELETE FROM "user" WHERE user_id = $1', [userid]);
            res.render("failed_to_add_by_admin.ejs",{admindata});
        }finally{
            client.release();
        }
});

//admin remove user button functionality
app.post("/admin/remove/user",async (req,res)=>{
    const{admindata}=req.body;
    res.render("admin_remove_user.ejs",{admindata});
});
//admin remove user functionality from form
app.post("/admin/remove/user/username",async (req,res)=>{
    let {admindata,username}=req.body;
    admindata=JSON.parse(admindata);
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        // Delete user (this will cascade delete related records)
        const deleteUserQuery = 'DELETE FROM "user" WHERE username = $1';
        await client.query(deleteUserQuery, [username]);
        await client.query("COMMIT");
        //add go back to dashboard button also
        res.render("sucessfully_removed_user.ejs",{admindata});
        console.log("User and all related records deleted successfully");
    } catch (error) {
        await client.query("ROLLBACK"); // Revert changes if an error occurs
        console.error("Error deleting user:", error);
        //add button to go back to dashboard also
        res.render("failed_to_remove_by_admin.ejs",{admindata});
    } finally {
        client.release();
    }
});
//update queries update button functionality
app.post("/admin/update",async (req,res)=>{
    const{admindata}=req.body;
    res.render("admin_update.ejs",{admindata});
});
//check for checkbox input prompt handling from frontend and backend you have given in chatgpt
//update stage 1: input username and role
app.post("/admin/update/stage1",async (req,res)=>{
    let {admindata,username,role}=req.body;
    admindata=JSON.parse(admindata);
    try{
        let result;
        result=await pool.query('SELECT * FROM "user" WHERE username=$1 AND role=$2',[username,role]);
        if(result.rows.length>0){
            if(role=="patient")
                res.render("patient_update_page_stage2.ejs",{admindata,userid:result.rows[0].user_id});
            else
                if(role=="doctor")
                    res.render("doctor_update_page_stage2.ejs",{admindata,userid:result.rows[0].user_id});
                else
                    if(role=="receptionist")
                        res.render("receptionist_update_page_stage2.ejs",{admindata,userid:result.rows[0].user_id});
                                }
            else                    
            res.render("admin_update.ejs",{admindata,invalidcred:"false"});                    
    }
    catch(error){
        console.error(error);
        console.log("unable to search for username while admin update");
                }

});
//update stage 2: input new details for patient
app.post("/admin/update/stage2/patient",async (req,res)=>{
    //update fields will contain all the checkbox field chosen or ticked
    let { admindata, userid, updatefield } = req.body;
    admindata=JSON.parse(admindata);
if (!updatefield) {
    res.render("patient_update_page_stage2.ejs", {
        admindata,
        userid: userid,
        nofieldchosend: "false"
    });
} else {
    // Ensure updatefield is always an array
    const fieldsToUpdate = Array.isArray(updatefield) ? updatefield : [updatefield];

    // Object to store which fields need updating
    let updateFlags = {
        name: "false",
        dob: "false",
        gender: "false",
        phone: "false",
        email: "false",
        address: "false",
        blood_group: "false",
        medical_history: "false",
        password: "false"
    };

    // Mark selected fields as "true"
    fieldsToUpdate.forEach(field => {
        switch (field) {
            case "name":
                updateFlags.name = "true";
                break;
            case "dob":
                updateFlags.dob = "true";
                break;
            case "gender":
                updateFlags.gender = "true";
                break;
            case "phone":
                updateFlags.phone = "true";
                break;
            case "email":
                updateFlags.email = "true";
                break;
            case "address":
                updateFlags.address = "true";
                break;
            case "blood_group":
                updateFlags.blood_group = "true";
                break;
            case "medical_history":
                updateFlags.medical_history = "true";
                break;
            case "password":
                updateFlags.password = "true";
                break;
        }
    });
    //remember the chosen fields must be set as required use an if else construct
    // Render update page with selected fields
    res.render("patient_update_stage3.ejs", {
        admindata,
        userid: userid,
        chosenfields:updateFlags  // Spread all update flags into the template
    });
}

});
//stage 3 for patient here we will receive new data and update all the fields
app.post("/admin/update/stage3/patient", async (req, res) => {
    let { admindata, userid, chosenfields } = req.body;
    admindata = JSON.parse(admindata);
    chosenfields = JSON.parse(chosenfields); // Parse chosenfields
    console.log(admindata);
    console.log(chosenfields);
    let client;
    try {
        client = await pool.connect();
        await client.query("BEGIN");

        let updateQuery = "UPDATE patient SET ";
        let updateValues = [];
        let index = 1;

        // Convert chosenfields object back into an array of selected fields
        let fieldsToUpdate = Object.keys(chosenfields).filter(field => chosenfields[field] === "true");

        if (!fieldsToUpdate.length) {
            throw new Error("No valid fields selected for update.");
        }

        fieldsToUpdate.forEach(field => {
             console.log(req.body[field]);
            if (field !== "password" && req.body[field]) { // Exclude password from patient table updates
                updateQuery += `${field} = $${index}, `;
                updateValues.push(req.body[field]);
                index++;
            }
        });

        if (updateValues.length > 0) { // Execute query only if there are valid updates
            updateQuery = updateQuery.slice(0, -2) + ` WHERE user_id = $${index}`;
            updateValues.push(userid);
            await client.query(updateQuery, updateValues);
        }

        // Handle password separately if included
        if (fieldsToUpdate.includes("password") && req.body.password) {
            await client.query('UPDATE "user" SET password = $1 WHERE user_id = $2', [req.body.password, userid]);
        }

        await client.query("COMMIT");
        res.render("successfully_updated.ejs", { admindata });
    } catch (error) {
        console.error("Error updating patient:", error);
        await client.query("ROLLBACK");
        res.render("update_failed.ejs", { admindata });
    } finally {
        if (client) client.release();
    }
});




// Update stage 2: Select fields to update for Receptionist
app.post("/admin/update/stage2/receptionist", async (req, res) => {
    let { admindata, userid, updatefield } = req.body;
    admindata=JSON.parse(admindata);
    if (!updatefield) {
        return res.render("receptionist_update_page_stage2.ejs", {
             admindata,
            userid: userid,
            nofieldchosend: "false"
        });
    }

    // Ensure updatefield is an array
    const fieldsToUpdate = Array.isArray(updatefield) ? updatefield : [updatefield];

    let updateFlags = {
        name: "false",
        email: "false",
        phone: "false",
        password: "false"
    };

    fieldsToUpdate.forEach(field => {
        switch (field) {
            case "name":
                updateFlags.name = "true";
                break;
            case "email":
                updateFlags.email = "true";
                break;
            case "phone":
                updateFlags.phone = "true";
                break;
            case "password":
                updateFlags.password = "true";
                break;
        }
    });

    // Render Stage 3 with chosen fields
    res.render("receptionist_update_stage3.ejs", {
        admindata,
        userid: userid,
        chosenfields: updateFlags
    });
});

// Stage 3 for Receptionist - Receive new data and update in DB
app.post("/admin/update/stage3/receptionist", async (req, res) => {
    let { admindata, userid, chosenfields } = req.body;
    console.log(req.body);
    admindata = JSON.parse(admindata);
    chosenfields = JSON.parse(chosenfields); // Parse chosenfields
    console.log(admindata);
    console.log(chosenfields);
    let client;
    try {
        client = await pool.connect();
        await client.query("BEGIN");

        let updateQuery = "UPDATE receptionist SET ";
        let updateValues = [];
        let index = 1;

        let fieldsToUpdate = Object.keys(chosenfields).filter(field => chosenfields[field] === "true");

        if (!fieldsToUpdate.length) {
            throw new Error("No valid fields selected for update.");
        }

        fieldsToUpdate.forEach(field => {
           
            if (field !== "password" && req.body[field]) { // Exclude password from receptionist table updates
                updateQuery += `${field} = $${index}, `;
                updateValues.push(req.body[field]);
                index++;
            }
        });

        if (updateValues.length > 0) { // Execute query only if there are valid updates
            updateQuery = updateQuery.slice(0, -2) + ` WHERE user_id = $${index}`;
            updateValues.push(userid);
            await client.query(updateQuery, updateValues);
        }

        // Handle password separately if included
        if (fieldsToUpdate.includes("password") && req.body.password) {
            await client.query('UPDATE "user" SET password = $1 WHERE user_id = $2', [req.body.password, userid]);
        }

        await client.query("COMMIT");
        res.render("successfully_updated.ejs", { admindata });
    } catch (error) {
        console.error("Error updating receptionist:", error);
        await client.query("ROLLBACK");
        res.render("update_failed.ejs", { admindata });
    } finally {
        if (client) client.release();
    }
});




// Update stage 2: Select fields to update for Doctor
app.post("/admin/update/stage2/doctor", async (req, res) => {
    let { admindata, userid, updatefield } = req.body;
    admindata=JSON.parse(admindata);
    if (!updatefield) {
        return res.render("doctor_update_page_stage2.ejs", {
             admindata,
            userid: userid,
            nofieldchosend: "false"
        });
    }

    // Ensure updatefield is an array
    const fieldsToUpdate = Array.isArray(updatefield) ? updatefield : [updatefield];

    let updateFlags = {
        name: "false",
        specializatio: "false",
        phone: "false",
        email: "false",
        availability: "false",
        password: "false"
    };

    fieldsToUpdate.forEach(field => {
        switch (field) {
            case "name":
                updateFlags.name = "true";
                break;
            case "specialization":
                updateFlags.specialization = "true";
                break;
            case "phone":
                updateFlags.phone = "true";
                break;
            case "email":
                updateFlags.email = "true";
                break;
            case "availability":
                updateFlags.availability = "true";
                break;
            case "password":
                updateFlags.password = "true";
                break;
        }
    });

    // Render Stage 3 with chosen fields
    res.render("doctor_update_stage3.ejs", {
        admindata,
        userid: userid,
        chosenfields: updateFlags
    });
});
// Stage 3 for Doctor - Receive new data and update in DB
app.post("/admin/update/stage3/doctor", async (req, res) => {
    let { admindata, userid, chosenfields } = req.body;
    admindata = JSON.parse(admindata);
    chosenfields = JSON.parse(chosenfields); // Parse chosenfields
    console.log(admindata);
    console.log(chosenfields);
    let client;
    try {
        client = await pool.connect();
        await client.query("BEGIN");

        let updateQuery = "UPDATE doctor SET ";
        let updateValues = [];
        let index = 1;

        let fieldsToUpdate = Object.keys(chosenfields).filter(field => chosenfields[field] === "true");

        if (!fieldsToUpdate.length) {
            throw new Error("No valid fields selected for update.");
        }

        fieldsToUpdate.forEach(field => {
            if (field !== "password" && req.body[field]) { // Exclude password from doctor table updates
                updateQuery += `${field} = $${index}, `;
                updateValues.push(req.body[field]);
                index++;
            }
        });

        if (updateValues.length > 0) { // Execute query only if there are valid updates
            updateQuery = updateQuery.slice(0, -2) + ` WHERE user_id = $${index}`;
            updateValues.push(userid);
            await client.query(updateQuery, updateValues);
        }

        // Handle password separately if included
        if (fieldsToUpdate.includes("password") && req.body.password) {
            await client.query('UPDATE "user" SET password = $1 WHERE user_id = $2', [req.body.password, userid]);
        }

        await client.query("COMMIT");
        res.render("successfully_updated.ejs", { admindata });
    } catch (error) {
        console.error("Error updating doctor:", error);
        await client.query("ROLLBACK");
        res.render("update_failed.ejs", { admindata });
    } finally {
        if (client) client.release();
    }
});
//view user
app.post("/admin/viewusers", async (req, res) => {
    const { admindata } = req.body;
    res.render("admin_select_role.ejs", { admindata });
});

app.post("/admin/viewusers/role", async (req, res) => {
    let { admindata, role } = req.body;
    admindata = JSON.parse(admindata);

    try {
        let queryResult;

        if (role === "patient") {
            queryResult = await pool.query(
                `SELECT "user".username, patient.name, patient.phone
                 FROM "user"
                 JOIN patient ON "user".user_id = patient.user_id
                 WHERE "user".role = $1`,
                [role]
            );
        } else if (role === "doctor") {
            queryResult = await pool.query(
                `SELECT "user".username, doctor.name, doctor.phone
                 FROM "user"
                 JOIN doctor ON "user".user_id = doctor.user_id
                 WHERE "user".role = $1`,
                [role]
            );
        } else if (role === "receptionist") {
            queryResult = await pool.query(
                `SELECT "user".username, receptionist.name, receptionist.phone
                 FROM "user"
                 JOIN receptionist ON "user".user_id = receptionist.user_id
                 WHERE "user".role = $1`,
                [role]
            );
        } else {
            return res.status(400).send("Invalid role selected.");
        }

        res.render("admin_view_users.ejs", {
            admindata,
            role,
            users: queryResult.rows,
        });
    } catch (error) {
        console.error("Error fetching user details:", error);
        res.status(500).send("Internal Server Error");
    }
});


//admin go back to dashboard
app.post("/admin/dashboard",async (req,res)=>{
    let {admindata}=req.body;
    admindata=JSON.parse(admindata);
    res.render("admin_dashboard.ejs",{admindata});
});
//logout
app.get("/logout",async (req, res) => {
    res.redirect("/");
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
//also for doctor he needs to be able to view appoinmets by date change their status and also add medical records
//also for all pages logout button must be added and go back button reception,doctor,patien,etc
//also for all pages logout button must be added and go back button reception,doctor,pati
//alos footer page hospital address,phone number and meet the team link
//for doctor from view appoinmets we can have appoinments status update and do this by sendin the appoinmets data received here to the next page also that is update appoinment data and then add a medical records also
//also it might be better to include appoinment id also in medical record table maybe discuss
//remember in doctor page date and time shouldn't be set required as default value will handle

//start from here
// 1)adding a direct button to update status
// 2)and a direct button to add medical records
// 3)also add admin page services