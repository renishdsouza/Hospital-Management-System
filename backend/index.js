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
app.use(express.json()); // For JSON data
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

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
app.get('/', async (req, res) => {
    res.render("login.ejs");
});
//on all dashboard add a logout button
// Login Route
app.post("/login/submit", async (req, res) => {
    const { username, password, role } = req.body;

    try {
        const result = await pool.query(
            'SELECT * FROM "user" WHERE username = $1 AND password = $2 AND role = $3',
            [username, password, role]
        );

        if (result.rows.length === 0) {
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

        // ✅ Ensure correct variable names are passed based on role
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
    console.log(receptionistdata);
    // Safely parse JSON strings if necessary
    try {
        patientdata = typeof patientdata === "string" ? JSON.parse(patientdata) : patientdata;
        receptionistdata = typeof receptionistdata === "string" ? JSON.parse(receptionistdata) : receptionistdata;
    } catch (error) {
        console.error("Error parsing data:", error);
        // Fallback to empty objects if parsing fails
        patientdata = {};
        receptionistdata = {};
    }

    // Validate that patient_id exists
    if (!patientdata.patient_id) {
        console.error("Error: patient_id is missing in patientdata");
        return res.redirect("/new/appointment/reception/failed");
    }

    console.log("Specialization:", chosen_specialization); // Debugging log
    console.log("Selected Doctor Name:", selected_doctor_name); // Debugging log

    try {
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
                    "INSERT INTO appointment (doctor_id, patient_id, date, time) VALUES ($1, $2, $3, $4)";
                await client.query(appointmentInsertQuery, [doctorid, patientdata.patient_id, date, time]);
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
            "SELECT a.appointment_id, a.date, a.time, a.status, d.name AS doctor_name, d.specialization " +
            "FROM appointment a JOIN doctor d ON a.doctor_id = d.doctor_id " +
            "WHERE a.patient_id = $1 ORDER BY a.date DESC",
            [patientdata.patient_id]
        );

        const appointments = patientAppointmentsResult.rows; // Store result in a variable

        // Return JSON if requested
        if (req.headers.accept === "application/json") {
            return res.json({ 
                patientdata, 
                appointments
            });
        }

        // Render the view with a flag if no appointments exist
        res.render("patient_view_appointment_page.ejs", {
            patientdata,
            appointments, // Pass array directly
            noAppointments: appointments.length === 0 // Flag for no appointments
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
app.post("/doctor/dashboard/appoinments",async (req,res)=>{
    const{doctordata}=req.body;
    res.render("doctor_appointment_view_date_selector.ejs",{doctordata:doctordata});
   
});
//allow option to choose a date and click submit and after displayin appointments there will be a button for
//go back to dashboard
app.post("/doctor/dashboard/appoinments/date",async (req,res)=>{
    const{doctordata,date}=req.body;
    try{
        let doctorappoinmentsresult;
        doctorappoinmentsresult=await pool.query("SELECT appointment.*, patient.username AS patient_username FROM appointment JOIN patient ON appointment.patient_id = patient.patient_id WHERE appointment.doctor_id = $1 AND appointment.date = $2",[doctordata.doctor_id,date]);
        if(doctorappoinmentsresult.rows.length>0)
            //here we are sending the patien names and username to uniquely identify patients
            res.render("doctor_display_appointments.ejs",{doctordata:doctordata,appoimentsdata:doctorappoinmentsresult.rows});
        else
            res.render("doctor_no_appointments_there_page.ejs",{doctordata:doctordata});
    } catch{
        console.log("Error in doctor view appointments page");
    }
});
//update appointment details of the day button fuctionality available on the display appointment page
//from the appointments he choose the patient username and patient name
app.post("/doctor/dashboard/appoinments/update",async (req,res)=>{
    const{doctordata,appointmentdata}=req.body;
    res.render("appointment_status_update.ejs",{doctordata:doctordata,appointmentdata:appointmentdata});
});
//update appointment status page upon submit of the username of patient 
app.post("/doctor/dashboard/appoinments/update/status",async (req,res)=>{
    const{doctordata,appointmentdata,username,status}=req.body;
    try{
        let patientresult;
        patientresult=await pool.query("SELECT patient_id FROM patient WHERE username = $1",[username]);
        let patientid=patientresult.rows[0].patient_id;
        const client=await pool.connect();
        try{
           await client.query("BEGIN");
           await client.query("UPDATE appointment SET status = $1 WHERE patient_id=$2 AND doctor_id=$3,AND date=$4",[status,patientid,doctordata.doctor_id,appointmentdata.rows[0].date]);
           await client.query("COMMIT");
                       //in the below rendered page add the go back to dashboard button
           res.render("appointment_status_updated.ejs",{doctordata:doctordata});
        }
        catch(error){
            await client.query("ROLLBACK");
            console.log("Error in updating appointment status");
            //in the below rendered page add the go back to dashboard button
            res.render("appointment_status_update_failed.ejs",{doctordata:doctordata});
        }
    }
    catch{
        console.log("Error in finding patiend id while appointment update from doctor");
    }
});
//from the display appointments page add medical record button
app.post("/doctor/dashboard/appoinments/medicalrecord",async (req,res)=>{
    const{doctordata,appointmentdata}=req.body;
    //remember we are not giving him an optinon to choose any date that we will have to store in the medical
    //records table
    //in the below page the doctor must enter patient username along with diagnosis,prescription
    res.render("add_medical_record_page.ejs",{doctordata:doctordata,appointmentdata:appointmentdata});
});
//now we will recive the patient username and the details of the colums of medical records
app.post("/doctor/dashboard/appoinments/medicalrecord/add",async (req,res)=>{
    const{doctordata,username,diagnosis,prescription}=req.body;
    try{
        let patientresult;
        patientresult=await pool.query("SELECT patient_id FROM patient WHERE username = $1",[username]);
        if(patientresult.rows.length<=0)
            //add go back to dashboard button also
            res.render("invalid_patient_details_page.ejs",{doctordata:doctordata});
        else{    
        let patientid=patientresult.rows[0].patient_id;
        const client=await pool.connect();
        try{
           await client.query("BEGIN");
           await client.query("INSERT INTO medicalrecords (patient_id, doctor_id, diagnosis, prescription) VALUES ($1, $2, $3, $4)",[patientid,doctordata.doctor_id,diagnosis,prescription]);
           await client.query("COMMIT");
                       //in the below rendered page add the go back to dashboard button
           res.render("medical_record_added_page.ejs",{doctordata:doctordata});
        }
        catch(error){
            await client.query("ROLLBACK");
            console.log("Error in adding medical recors");
            //in the below rendered page add the go back to dashboard button
            res.render("medical_record_add_fail.ejs",{doctordata:doctordata});
        }
    }
    }
    catch{
        console.log("Error in finding patiend id while appointment update from doctor");
    }

});
//update appointment button functionality from dashboard
app.post("/doctor/dashboard/appoinments/updatestatus",async (req,res)=>{
    const{doctordata}=req.body;
    res.render("direct_status_update_appointment.ejs",{doctordata:doctordata});
});
//update appointment status after date is submitted from form 
app.post("/doctor/dashboard/appoinments/date",async (req,res)=>{
    const{doctordata,date}=req.body;
    try{
        let doctorappoinmentsresult;
        doctorappoinmentsresult=await pool.query("SELECT appointment.*, patient.username AS patient_username FROM appointment JOIN patient ON appointment.patient_id = patient.patient_id WHERE appointment.doctor_id = $1 AND appointment.date = $2",[doctordata.doctor_id,date]);
        if(doctorappoinmentsresult.rows.length>0)
            //here we are sending the patien names and username to uniquely identify patients
            res.redirect("/doctor/dashboard/appoinments/update",{doctordata:doctordata,appointmentdata:doctorappoinmentsresult.rows});
        else
            res.render("doctor_no_appointments_there_page.ejs",{doctordata:doctordata});
    } catch{
        console.log("Error in doctor view appointments page");
    }
    
});
//add medical records functionality
app.post("/doctor/dashboard/appoinments/medicalrecord/add",async (req,res)=>{
    const{doctordata}=req.body;
    //in this page the doctor will have to enter paitent username
    res.render("add_medical_record_page.ejs",{doctordata:doctordata});
});
//go back to doctor dashboard button
app.post("/doctor/dashboard",async (req,res)=>{
    const{doctordata}=req.body;
    res.render("doctor_dashboard.ejs",{doctordata:doctordata});
});

//admin add new user button functionality
app.post("/admin/dashboard/users/add",async (req,res)=>{
    const{admindata}=req.body;
    res.render("add_user_page.ejs",{admindata:admindata});
});
//admin add new user page here there will be next button upon clicking that request will come to below
app.post("/admin/add/new/user/stage1",async (req,res)=>{
    //username password and role 
    const{admindata,username,password,role}=req.body;
    //here we are checking if the username is already taken
   let usercheck= pool.query("SELECT * FROM user WHERE username = $1",[username]);
   if(usercheck.rows.length>0)
        res.render("add_user_page.ejs",{admindata:admindata, useralreadypresent:"true"});
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
            res.render("add_patient_page.ejs",{admindata:admindata,userid:userId});
        else if(role=="doctor")
                res.render("add_doctor_page.ejs",{admindata:admindata,userid:userId});
            else
            res.render("add_receptionist_page.ejs",{admindata:admindata,userid:userId});


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
    const{admindata,userid,name, dob, gender, phone, email, address, bloodgroup, medical_history}=req.body;
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const patientInsertQuery = 'INSERT INTO "patient" (user_id, name, dob, gender, phone, email, address, bloodgroup, medical_history) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)';
        await client.query(patientInsertQuery, [userId, name, dob, gender, phone, email, address, bloodgroup, medical_history]);
        await client.query("COMMIT");
        //this page must contain a button to go back to dashboard
        res.render("sucessfully_added_admin.ejs",{admindata:admindata});
    } catch(error){
        console.log("unable to add into patient table by admin");
        await client.query("ROLLBACK");
        //deleting user table entry also
        await client.query('DELETE FROM "user" WHERE username = $1', [username]);
        //also add go back to dashboard button
        res.render("failed_to_add_by_admin.ejs",{admindata:admindata});
    }finally{
        client.release();
    }

});
//new doctor add by admin
app.post("/admin/add/new/doctor/stage2",async (req,res)=>{
    const{admindata,userid,name,specialization,phone,email,availability}=req.body;
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const doctorInsertQuery = 'INSERT INTO "doctor" (user_id, name, phone, email,specialization,availability) VALUES ($1,$2,$3,$4,$5)';
        await client.query(doctorInsertQuery, [userid, name,phone,email,specialization,availability]);
        await client.query("COMMIT");
        res.render("sucessfully_added_admin.ejs",{admindata:admindata});
    } catch(error){
        console.log("unable to add into doctor table by admin");
        await client.query("ROLLBACK");
        await client.query('DELETE FROM "user" WHERE username = $1', [username]);
        res.render("failed_to_add_by_admin.ejs",{admindata:admindata});
    }finally{
        client.release();
    }
});
//new receptionist add by admin
app.post("/admin/add/new/receptionist/stage2",async (req,res)=>{
    const{admindata,userid,name,phone,email}=req.body;
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const receptionInsertQuery = 'INSERT INTO "receptionist" (user_id, name, phone, email) VALUES ($1,$2,$3,$4)';
        await client.query(receptionInsertQuery, [userid, name,phone,email]);
        await client.query("COMMIT");
        res.render("sucessfully_added_admin.ejs",{admindata:admindata});
        }catch(error){
            console.log("unable to add into receptionist table by admin");
            await client.query("ROLLBACK");
            await client.query('DELETE FROM "user" WHERE username = $1', [username]);
            res.render("failed_to_add_by_admin.ejs",{admindata:admindata});
        }finally{
            client.release();
        }
});

//admin remove user button functionality
app.post("/admin/remove/user",async (req,res)=>{
    const{admindata}=req.body;
    res.render("admin_remove_user.ejs",{admindata:admindata});
});
//admin remove user functionality from form
app.post("/admin/remove/user/username",async (req,res)=>{
    const{admindata,username}=req.body;
    try {
        await client.query("BEGIN");
        // Delete user (this will cascade delete related records)
        const deleteUserQuery = 'DELETE FROM "user" WHERE username = $1';
        await client.query(deleteUserQuery, [username]);
        await client.query("COMMIT");
        //add go back to dashboard button also
        res.render("sucessfully_removed_user.ejs",{admindata:admindata});
        console.log("User and all related records deleted successfully");
    } catch (error) {
        await client.query("ROLLBACK"); // Revert changes if an error occurs
        console.error("Error deleting user:", error);
        //add button to go back to dashboard also
        res.render("failed_to_remove_by_admin.ejs",{admindata:admindata});
    } finally {
        client.release();
    }
});
//update queries update button functionality
app.post("/admin/update",async (req,res)=>{
    const{admindata}=req.body;
    res.render("admin_update.ejs",{admindata:admindata});
});
//check for checkbox input prompt handling from frontend and backend you have given in chatgpt
//update stage 1: input username and role
app.post("/admin/update/stage1",async (req,res)=>{
    const{admindata,username,role}=req.body;
    try{
        let result;
        result=await pool.query('SELECT * FROM "user" WHERE username=$1 AND role=$2',[username,role]);
        if(result.rows.length>0){
            if(role=="patient")
                res.render("patient_update_page_stage2.ejs",{admindata:admindata,userid:result.rows[0].user_id});
            else
                if(role=="doctor")
                    res.render("doctor_update_page_stage2.ejs",{admindata:admindata,userid:result.rows[0].user_id});
                else
                    if(role=="receptionist")
                        res.render("recetpionist_update_page_stage2.ejs",{admindata:admindata,userid:result.rows[0].user_id});
                                }
            else                    
            res.render("admin_update.ejs",{admindata:admindata,invalidcred:"false"});                    
    }
    catch(error){
        console.log("unable to search for username while admin update");
                }

});
//update stage 2: input new details for patient
app.post("/admin/update/stage2/patient",async (req,res)=>{
    //update fields will contain all the checkbox field chosen or ticked
    const { admindata, userid, updatefield } = req.body;

if (!updatefield) {
    res.render("patient_update_page_stage2.ejs", {
        admindata: admindata,
        userid: userid,
        nofieldchosend: "false"
    });
} else {
    // Ensure updatefield is always an array
    const fieldsToUpdate = Array.isArray(updatefield) ? updatefield : [updatefield];

    // Object to store which fields need updating
    let updateFlags = {
        nameupdate: "false",
        dobupdate: "false",
        genderupdate: "false",
        phoneupdate: "false",
        emailupdate: "false",
        addressupdate: "false",
        bloodgroupupdate: "false",
        medicalhistoryupdate: "false",
        passwordupdate: "false"
    };

    // Mark selected fields as "true"
    fieldsToUpdate.forEach(field => {
        switch (field) {
            case "name":
                updateFlags.nameupdate = "true";
                break;
            case "dob":
                updateFlags.dobupdate = "true";
                break;
            case "gender":
                updateFlags.genderupdate = "true";
                break;
            case "phone":
                updateFlags.phoneupdate = "true";
                break;
            case "email":
                updateFlags.emailupdate = "true";
                break;
            case "address":
                updateFlags.addressupdate = "true";
                break;
            case "blood_group":
                updateFlags.bloodgroupupdate = "true";
                break;
            case "medical_history":
                updateFlags.medicalhistoryupdate = "true";
                break;
            case "password":
                updateFlags.passwordupdate = "true";
                break;
        }
    });
    //remember the chosen fields must be set as required use an if else construct
    // Render update page with selected fields
    res.render("patient_update_stage3.ejs", {
        admindata: admindata,
        userid: userid,
        chosenfields:updateFlags  // Spread all update flags into the template
    });
}

});
//stage 3 for patient here we will receive new data and update all the fields
    app.post("/admin/update/stage3/patient", async (req, res) => {
        const { admindata, userid, chosenfields } = req.body;
    
        let client;
        try {
            client = await pool.connect();
            await client.query("BEGIN");
    
            let updateQuery = "UPDATE patient SET ";
            let updateValues = [];
            let index = 1;
    
            // Convert chosenfields object back into an array of selected fields
            let fieldsToUpdate = Object.keys(chosenfields).filter(field => chosenfields[field] === "true");
    
            fieldsToUpdate.forEach(field => {
                if (field !== "password" && req.body[field]) {  // Exclude password update in patient table
                    updateQuery += `${field} = $${index}, `;
                    updateValues.push(req.body[field]);
                    index++;
                }
            });
    
            if (updateValues.length > 0) {  // Only execute if there are valid updates
                updateQuery = updateQuery.slice(0, -2) + ` WHERE user_id = $${index}`;
                updateValues.push(userid);
                await client.query(updateQuery, updateValues);
            }
    
            // Handle password separately if included (No hashing)
            if (fieldsToUpdate.includes("password") && req.body.password) {
                await client.query("UPDATE \"user\" SET password = $1 WHERE user_id = $2", [req.body.password, userid]);
            }
    
            await client.query("COMMIT");
            //also add go back to admin dashboard button
            res.render("successfully_updated.ejs", { admindata: admindata });
    
        } catch (error) {
            console.error("Error updating patient:", error);
            await client.query("ROLLBACK");
             //also add go back to admin dashboard button
            res.render("update_failed.ejs", { admindata: admindata });
        } finally {
            if (client) client.release();
        }
    });

// Update stage 2: Select fields to update for Receptionist
app.post("/admin/update/stage2/receptionist", async (req, res) => {
    const { admindata, userid, updatefield } = req.body;

    if (!updatefield) {
        return res.render("receptionist_update_page_stage2.ejs", {
            admindata: admindata,
            userid: userid,
            nofieldchosend: "false"
        });
    }

    // Ensure updatefield is an array
    const fieldsToUpdate = Array.isArray(updatefield) ? updatefield : [updatefield];

    let updateFlags = {
        nameupdate: "false",
        emailupdate: "false",
        phoneupdate: "false",
        passwordupdate: "false"
    };

    fieldsToUpdate.forEach(field => {
        switch (field) {
            case "name":
                updateFlags.nameupdate = "true";
                break;
            case "email":
                updateFlags.emailupdate = "true";
                break;
            case "phone":
                updateFlags.phoneupdate = "true";
                break;
            case "password":
                updateFlags.passwordupdate = "true";
                break;
        }
    });

    // Render Stage 3 with chosen fields
    res.render("receptionist_update_stage3.ejs", {
        admindata: admindata,
        userid: userid,
        chosenfields: updateFlags
    });
});

// Stage 3 for Receptionist - Receive new data and update in DB
app.post("/admin/update/stage3/receptionist", async (req, res) => {
    const { admindata, userid, chosenfields } = req.body;

    let client;
    try {
        client = await pool.connect();
        await client.query("BEGIN");

        let updateQuery = 'UPDATE receptionist SET ';
        let updateValues = [];
        let index = 1;

        let fieldsToUpdate = Object.keys(chosenfields).filter(field => chosenfields[field] === "true");

        fieldsToUpdate.forEach(field => {
            if (field !== "password" && req.body[field]) {  // Exclude password update in receptionist table
                updateQuery += `${field} = $${index}, `;
                updateValues.push(req.body[field]);
                index++;
            }
        });

        if (updateValues.length > 0) { 
            updateQuery = updateQuery.slice(0, -2) + ` WHERE user_id = $${index}`;
            updateValues.push(userid);
            await client.query(updateQuery, updateValues);
        }

        // Handle password separately if selected (No hashing)
        if (fieldsToUpdate.includes("password") && req.body.password) {
            await client.query('UPDATE "user" SET password = $1 WHERE user_id = $2', [req.body.password, userid]);
        }

        await client.query("COMMIT");
        res.render("successfully_updated.ejs", { admindata: admindata });

    } catch (error) {
        console.error("Error updating receptionist:", error);
        await client.query("ROLLBACK");
        res.render("update_failed.ejs", { admindata: admindata });
    } finally {
        if (client) client.release();
    }
});
// Update stage 2: Select fields to update for Doctor
app.post("/admin/update/stage2/doctor", async (req, res) => {
    const { admindata, userid, updatefield } = req.body;

    if (!updatefield) {
        return res.render("doctor_update_page_stage2.ejs", {
            admindata: admindata,
            userid: userid,
            nofieldchosend: "false"
        });
    }

    // Ensure updatefield is an array
    const fieldsToUpdate = Array.isArray(updatefield) ? updatefield : [updatefield];

    let updateFlags = {
        nameupdate: "false",
        specializationupdate: "false",
        phoneupdate: "false",
        emailupdate: "false",
        availabilityupdate: "false",
        passwordupdate: "false"
    };

    fieldsToUpdate.forEach(field => {
        switch (field) {
            case "name":
                updateFlags.nameupdate = "true";
                break;
            case "specialization":
                updateFlags.specializationupdate = "true";
                break;
            case "phone":
                updateFlags.phoneupdate = "true";
                break;
            case "email":
                updateFlags.emailupdate = "true";
                break;
            case "availability":
                updateFlags.availabilityupdate = "true";
                break;
            case "password":
                updateFlags.passwordupdate = "true";
                break;
        }
    });

    // Render Stage 3 with chosen fields
    res.render("doctor_update_stage3.ejs", {
        admindata: admindata,
        userid: userid,
        chosenfields: updateFlags
    });
});
// Stage 3 for Doctor - Receive new data and update in DB
app.post("/admin/update/stage3/doctor", async (req, res) => {
    const { admindata, userid, chosenfields } = req.body;

    let client;
    try {
        client = await pool.connect();
        await client.query("BEGIN");

        let updateQuery = 'UPDATE doctor SET ';
        let updateValues = [];
        let index = 1;

        let fieldsToUpdate = Object.keys(chosenfields).filter(field => chosenfields[field] === "true");

        fieldsToUpdate.forEach(field => {
            if (field !== "password" && req.body[field]) {  // Exclude password update in doctor table
                updateQuery += `${field} = $${index}, `;
                updateValues.push(req.body[field]);
                index++;
            }
        });

        if (updateValues.length > 0) { 
            updateQuery = updateQuery.slice(0, -2) + ` WHERE user_id = $${index}`;
            updateValues.push(userid);
            await client.query(updateQuery, updateValues);
        }

        // Handle password separately if selected (No hashing)
        if (fieldsToUpdate.includes("password") && req.body.password) {
            await client.query('UPDATE "user" SET password = $1 WHERE user_id = $2', [req.body.password, userid]);
        }

        await client.query("COMMIT");
        res.render("successfully_updated.ejs", { admindata: admindata });

    } catch (error) {
        console.error("Error updating doctor:", error);
        await client.query("ROLLBACK");
        res.render("update_failed.ejs", { admindata: admindata });
    } finally {
        if (client) client.release();
    }
});

//admin go back to dashboard
app.get("/admin/dashboard",async (req,res)=>{
    const{admindata}=req.body;
    res.render("admin_dashboard.ejs",{admindata:admindata});
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