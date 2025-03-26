import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
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
app.set("view engine","ejs");

const pool = new pg.Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST ,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD ,
    port: process.env.DB_PORT ,
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
    const { username, password,role} = req.body;
    try {
        const result = await pool.query(
            "SELECT * FROM user WHERE username = $1 AND password = $2 AND role=$3",
            [username, password,role]
        );
        if (result.rows.length > 0) {
            if(req.body["role"]=="patient"){
                let patientresult;
                try{
                     patientresult = await pool.query(
                        "SELECT * FROM Patient WHERE user_id=$1",
                        [result.rows[0].user_id]
                                                            );
                    }
                catch(err){
                    console.log(err);
                    res.status(500).send("Server error");
                           }
                if(patientresult.rows.length>0)
                    res.render("patient_dashboard.ejs",patientresult.rows);
                else
                    console.log("user entry exists but patient table entry missing");
                } else

                if(req.body["role"]=="doctor"){
                    let doctorresult;
                        try{
                             doctorresult = await pool.query(
                                "SELECT * FROM Doctor WHERE user_id=$1",
                                [result.rows[0].user_id]
                                                                    );
                            }
                        catch(err){
                            console.log(err);
                            res.status(500).send("Server error");
                                }
                    if(doctorresult.rows.length>0)
                        res.render("doctor.ejs",doctorresult.rows);

                }   else{

                if(req.body["role"]=="admin"){
                res.render("admin.ejs",{name:username});
                } else{

                    res.render("reception.ejs");
                }
            }
        } else {
            res.render("login.ejs",{status:"false"});
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});
    

    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });