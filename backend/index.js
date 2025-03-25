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



    

    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });