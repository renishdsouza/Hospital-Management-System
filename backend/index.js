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
                        'SELECT * FROM "patient" WHERE user_id=$1',
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
                        'SELECT * FROM "doctor" WHERE user_id=$1',
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
                        'SELECT * FROM "admin" WHERE user_id=$1',
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
                        'SELECT * FROM "receptionist" WHERE user_id=$1',
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
        const patientInsertQuery = 'INSERT INTO "patient" (user_id, name, dob, gender, phone, email, address, bloodgroup, medical_history) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)';
        await client.query(patientInsertQuery, [userId, name, dob, gender, phone, email, address, bloodgroup, medical_history]);

        await client.query("COMMIT");
        //if it is true then add to ejs file something to show a message like patiend added successfully for some second or display an alert if true
        //if the value is false then display a message like patient registration failed
        res.render("reception_dashboard.ejs", { receptionnistdata: receptionnistdatasent, newpatientregisterstatus: "true" });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Transaction failed:", error);
        res.render("reception_dashboard.ejs", { receptionnistdata: receptionnistdatasent, newpatientregisterstatus: "false" });
    } finally {
        client.release();
    }
});

//appoinment schedule receptionist stage1
app.post("/new/appoinment/schedule/reception/stage1",async(req,res)=>{
    const{receptionnistdatarecieved,dob,gender,phone}=req.body;
    
    try{
        let patientquerresult;
        patientquerresult=await pool.query("SELECT * FROM patient WHERE phone=$1 AND gender=$2 AND dob=$3",
            [phone,gender,dob]);
            if(patientquerresult.rows.length>0){
                res.render("appoinment_scheduler_page_stage2.ejs",{receptiondata:receptionnistdatarecieved,
                    patientdetails:patientquerresult.rows[0]});
                    } else{
                        res.render("reception_dashboard.ejs",{receptionnistdata:receptionnistdatarecieved,patientfound:"false"});
                    }
    }
    catch{
        console.error("Error in appoinment scheduler patient search");
        }        
                                
});

// appoinment schedule,stage 2 to stage 3 send logic stage 2 we have to confirm the patient details
app.post("/new/appoinment/schedule/reception/stage2", async (req, res)=>{
    const {patientdetails,receptionnistdata}=req.body;
    res.render("appoinment_scheduler_page_stage3.ejs",{patientdata:patientdetails,receptiondata:receptionnistdata});
});

//appoinment schedule stage 3
app.post("/new/appoinment/schedule/reception/stage3", async (req, res)=>{
    const{patiendatarecevied,receptiondata}=req.body;
    //now here upon choosing a specialist all the doctor names must be given under select option 
    //ask rithvik how this will be implemtned in frontend
    //now before deciding anything in the temp database only timing is available maybe under assumtion that
    //he is available every day also if we want him to be available everyday then maybe keep a limit 
    //for the number of appoinments he can take in a day and if the count of existing appoinments with that
    //doctor is already equal to the limit then show to choose another date
    //now option 2 is no such thing as limit and in terms of availability have days and when the user
    //gives a date as input we will check what day it is and if the doctor is available or not
    //if available we will allow for the appoinment to be scheduled otherise we have to give some 
    //error message in frontend and also we might have to maintain a limit of appoinments for each day
    //my choice is to go with the first approach with doctor available on all days
});
//apoinment token number  page with date and token number and doctor name

//go back to dashboard reception
app.post("/reception/dashboard", (req, res) => {
    const{receptionistdata}=req.body;
    res.render("reception_dashboard.ejs",{receptionnistdata:receptionistdata});
});

//in patients page  view appoinments
app.post("/patient/appoinment",async (req,res)=>{
    const{patientdata}=req.body;
    try{
        let patientappoinmentsresult;
        patientappoinmentsresult=await pool.query("SELECT * FROM appointment WHERE patient_id = $1 ORDER BY date DESC",[patientdata.patient_id]);
        if(patientappoinmentsresult.rows.length>0)
        res.render("patient_view_appoinment_page.ejs",{patientdata:patientdata,appoimentsdata:patientappoinmentsresult,noappoinments:"false"});
    else
    res.render("patient_view_appoinment_page.ejs",{patientdata:patientdata,noappoinments:"true"});
    }
    catch{
        console.error("Error in patient view appoinment page");

    }
});
//in patients page add another option to view all medical records
app.post("/patients/medical/records",async (req,res)=>{
    const{patientdata}=req.body;
    try{
        let patientmedicalrecordresult;
        patientmedicalrecordresult=await pool.query("SELECT * FROM medical_record WHERE patient_id = $1 ORDER BY visit_date",patientdata.patient_id);
        if(patientmedicalrecordresult.rows.length>0)
        res.render("patient_view_medical_record_page.ejs",{patientdata:patientdata,medicalrecords:patientmedicalrecordresult,norecords:"false"});
    else
        res.render("patient_view_medical_record_page.ejs",{patientdata:patientdata,norecords:"true"});
    }
    catch{
        console.error("Error in patient view medical records page");
    }
});
//go back to dashboard patient
app.post("/patients/dashboard",async (req,res)=>{
    const{patientdata}=req.body;
    res.render("patient_dashboard.ejs",{patientdata:patientdata});
});

//logout
app.get("/logout", (req, res) => {
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