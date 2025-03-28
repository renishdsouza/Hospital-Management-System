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
                let receptionnistresult;
                try {
                    receptionnistresult = await pool.query(
                        'SELECT * FROM "receptionnist" WHERE user_id=$1',
                        [result.rows[0].user_id]
                    );
                } catch (err) {
                    console.log(err);
                    res.status(500).send("Server error");
                }
                if (receptionnistresult.rows.length > 0)
                    res.render("reception_dashboard.ejs", { receptionnistdata: receptionnistresult.rows[0] });
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
    let {receptionnistdata}=req.body;
    res.render("new_patient_register.ejs", { receptionnistdata:receptionnistdata });
});

//new patient registeration page action
app.post("/new/patient/register/submit", async (req, res) => {
    const { receptionnistdata, username, password, name, dob, gender, phone, email, address, bloodgroup, medical_history } = req.body;
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
        res.render("reception_dashboard.ejs", { receptionnistdata: receptionnistdata, newpatientregisterstatus: "true" });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Transaction failed:", error);
        res.render("reception_dashboard.ejs", { receptionnistdata: receptionnistdata, newpatientregisterstatus: "false" });
    } finally {
        client.release();
    }
});
//first appionments stage 1 page
app.post("/appoinment/reception/schedule",(req,res)=>{
    const {receptiondata}=req.body;
    res.render("first_appoinment_stage_1.ejs",{receptiondata:reception});
})
//appoinment schedule receptionnist stage1
app.post("/new/appoinment/schedule/reception/stage1",async(req,res)=>{
    const{receptionnistdata,dob,username}=req.body;
    
    try{
        let patientquerresult;
        let userid,resultuser;
        //get the userid with the given username
        resultuser=await pool.query('SELECT * FROM "user" WHERE username=$1',[username]);
        userid=resultuser.rows[0].user_id;
        patientquerresult=await pool.query("SELECT * FROM patient WHERE user_id=$1  AND dob=$2",
            [userid,dob]);
            if(patientquerresult.rows.length>0){
                res.render("appoinment_scheduler_page_stage2.ejs",{receptiondata:receptionnistdata,
                    patientdetails:patientquerresult.rows[0]});
                    } else{
                        res.render("reception_dashboard.ejs",{receptionnistdata:receptionnistdata,patientfound:"false"});
                    }
    }
    catch{
        console.error("Error in appoinment scheduler patient search");
        }        
                                
});

// appoinment schedule,stage 2 to stage 3 send logic now below is  stage 2 we have to confirm the patient details
app.post("/new/appoinment/schedule/reception/stage2/confirm", async (req, res)=>{
    const {patientdetails,receptionnistdata}=req.body;
    try{
        let doctorspecialization;
        doctorspecialization=await pool.query("SELECT DISTINCT specialization FROM doctor");
    res.render("appoinment_scheduler_page_stage3.ejs",{patientdata:patientdetails,receptionnistdata:receptionnistdata,specialization:doctorspecialization.rows});
    } catch(error){
        console.log("unable to get doctor specialization");
    }
});

//appoinment schedule stage 3 here patien will have to choose a specialization this needs to be a 
//separate form in html where upon selecting a option i will get a method=post and action as
// the path specified down /new/appoinmets/....
app.post("/new/appoinment/schedule/reception/stage3/specialization", async (req, res)=>{
    //ignore the coments below inside this
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
//so here after choosing the specialization we will renser the doctor names available
const{patiendata,receptionnistdata,specialization}=req.body;
try{
    let doctorqueryresult;
    doctorqueryresult=await pool.query("SELECT * FROM doctor WHERE specialization=$1",[specialization]);
    if(doctorqueryresult.rows.length>0){
        res.render("appoinment_scheduler_page_stage3.ejs",{patientdata:patiendata,receptionnistdata:receptionnistdata,doctors:doctorqueryresult.rows});
    }else{
        console.log("doctor specialization error");
    }

}
catch{
    console.error("Error in appoinment scheduler stage 3");

}


});
//but we need to ensure doctor names are unique at present within the same specialization
//after choosing doctor date and time the second will have this within the same page
app.post("/add/appoinment",async (req,res)=>{
    const{patiendata,receptionnistdata,selected_doctor_name,specialization,date,time}=req.body;
    let doctorqueryresult;
    try{
        doctorqueryresult=await pool.query("SELECT * FROM doctor WHERE specialization=$1 AND name=$2",[specialization,selected_doctor_name]);
        if(doctorqueryresult.rows.length>0){
            const doctorid=doctorqueryresult.rows[0].doctor_id;
            const client=await pool.connect();
            try{
                await client.query("BEGIN");
                const appionmentinsertquery="INSERT INTO appointment (doctor_id,patient_id,date,time) VALUES ($1,$2,$3,$4)";
                const appionmentinsertresult=await client.query(appionmentinsertquery,[doctorid,patiendata.id,date,time]);
                await client.query("COMMIT");
                res.redirect("/new/appoinment/schedule/reception/stage4",{receptiondata:receptionnistdata});
            }
            catch (error) {
                await client.query("ROLLBACK");
                console.error("Transaction failed:", error);
                res.redirect("/new/appointment/reception/failed",{receptionnistdata:receptionnistdata});
            } finally {
                client.release();
            }

        }
    }
    catch (error){
        console.error("Error in appoinment scheduler");
    }
});
//succesful appoinmet scheduled message and go back to dashboard button
app.post("/new/appoinment/schedule/reception/stage4",async(req,res)=>{
    const{receptiondata}=req.body;
    res.render("success_appointment_schedule_reception.ejs",{receptiondata:receptiondata});
});
//failed appoinmet schedule and also give the button to go back to dashboard
app.post("/new/appointment/reception/failed",async(req,res)=>{
    const{receptionnistdata}=req.body;
    res.render("failed_appointment_schedule_reception.ejs",{receptionnistdata:reception});
});
//go back to dashboard reception button in the above 2 ejs file
app.post("/reception/dashboard", async (req, res) => {
    const{receptionnistdata}=req.body;
    res.render("reception_dashboard.ejs",{receptionnistdata:receptionnistdata});
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
    res.render("add_medical_record_page.ejs",{doctordata:doctordata,appointmentdata:appointmentdata});
});
//now we will recive the patient username and the details of the colums of medical records
app.post("/doctor/dashboard/appoinments/medicalrecord/add",async (req,res)=>{
    const{doctordata,username,diagnosis,prescription}=req.body;
    try{
        let patientresult;
        patientresult=await pool.query("SELECT patient_id FROM patient WHERE username = $1",[username]);
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
    catch{
        console.log("Error in finding patiend id while appointment update from doctor");
    }

});
//go back to doctor dashboard button
app.post("/doctor/dashboard",async (req,res)=>{
    const{doctordata}=req.body;
    res.render("doctor_dashboard.ejs",{doctordata:doctordata});
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
