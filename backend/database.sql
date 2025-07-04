-- Drop existing tables if they exist (to avoid conflicts)
DROP TABLE IF EXISTS medicalrecords, appointment, patient, doctor, receptionist, admin, "user" CASCADE;

-- Drop ENUM types if they already exist
DROP TYPE IF EXISTS user_role, gender_type, appointment_status;

-- Create ENUM types
CREATE TYPE user_role AS ENUM ('admin', 'doctor', 'receptionist', 'patient');
CREATE TYPE gender_type AS ENUM ('Male', 'Female', 'Other');
CREATE TYPE appointment_status AS ENUM ('Scheduled', 'Completed', 'Cancelled');

-- User Table
--5nf
CREATE TABLE "user" (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role user_role NOT NULL
);

-- Patient Table
--5nf
CREATE TABLE patient (
    patient_id SERIAL PRIMARY KEY,--similar to auto-increment in sql
    user_id INT UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    dob DATE NOT NULL,
    gender gender_type NOT NULL,
    phone VARCHAR(15)  NOT NULL,
    email VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    blood_group VARCHAR(5),
    medical_history TEXT,
    FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE CASCADE --will ensure referential integrity constraint
);

-- Doctor Table
--5nf
CREATE TABLE doctor (
    doctor_id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL, 
    specialization VARCHAR(100) NOT NULL,
    phone VARCHAR(15)  NOT NULL,
    email VARCHAR(100)  NOT NULL,
    availability VARCHAR(50) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE CASCADE
);

-- Receptionist Table
--5nf
CREATE TABLE receptionist (
    receptionist_id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100)  NOT NULL,
    phone VARCHAR(15)  NOT NULL,
    FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE CASCADE
);

-- Admin Table
--5nf
CREATE TABLE admin (
    admin_id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100)  NOT NULL,
    phone VARCHAR(15)  NOT NULL,
    FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE CASCADE
);

-- Appointment Table
--5nf
CREATE TABLE appointment (
    appointment_id SERIAL PRIMARY KEY,
    patient_id INT NOT NULL, 
    doctor_id INT NOT NULL, --make it nullable
    date DATE NOT NULL,
    time TIME NOT NULL DEFAULT '00:00:00',
    status appointment_status NOT NULL DEFAULT 'Scheduled',
    FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctor(doctor_id) ON DELETE CASCADE
);

-- Medical Records Table
--5nf
CREATE TABLE medicalrecords (
    record_id SERIAL PRIMARY KEY,
    patient_id INT NOT NULL,
    doctor_id INT, -- Made nullable since ON DELETE SET NULL
    appointment_id INT, -- New column to reference appointment table
    diagnosis TEXT NOT NULL DEFAULT 'No Diagnosis',
    prescription TEXT DEFAULT 'No Prescription',
    visit_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctor(doctor_id) ON DELETE SET NULL,
    FOREIGN KEY (appointment_id) REFERENCES appointment(appointment_id) ON DELETE SET NULL
);

--INSERT INTO "user" (username, password, role) VALUES
--('patient1', 'pass1', 'patient'),
--('patient2', 'pass2', 'patient'),
--('patient3', 'pass3', 'patient'),
--('patient4', 'pass4', 'patient'),
--('patient5', 'pass5', 'patient'),
--('doctor1', 'docpass1', 'doctor'),
--('doctor2', 'docpass2', 'doctor'),
--('doctor3', 'docpass3', 'doctor'),
--('doctor4', 'docpass4', 'doctor'),
--('doctor5', 'docpass5', 'doctor'),
--('receptionist1', 'receppass1', 'receptionist'),
--('admin1', 'adminpass1', 'admin');
-- For the hashing part saltround is 10 change you chnage that change all the passwords too.
INSERT INTO "user" (username, password, role) VALUES
('patient1', '$2b$10$DJbjentTNvqwoXFoSX3ruOibYUwA0ipS9FIVfK1CH918/EA/tDIKK', 'patient'),
('patient2', '$2b$10$H7T0Gl4TXl4yjadC.zJQDu/hfVjNqLtx9dvfugW0eO7F4hpjeTNta', 'patient'),
('patient3', '$2b$10$rVcP00FxjVXWba2A0UhNtOdN740hU/mF.geB8J64LLZycPDaUpkee', 'patient'),
('patient4', '$2b$10$CTqgB2xz3E2ewF.mi1tIaeFVQJQZfN7DpoeJuYtNBkh6RjVBVEN/i', 'patient'),
('patient5', '$2b$10$qsE/7xZHJVaTJMXWWvmpkubpTZzh97eLt/kj/JbTv93S8qOcXW8M.', 'patient'),
('doctor1', '$2b$10$WkM/CNyg7u3O6vryhBcfI.7nPcrOPHE4.OBf.KpDv2JD1P83rJfKa', 'doctor'),
('doctor2', '$2b$10$dMlvLiRsSEc5UaX3r/Q.bu2cKaVykdYsr/h.mzIIa5IA2L3aI0nha', 'doctor'),
('doctor3', '$2b$10$IXGeDFdsmdE7Q.E/d3Wv0eV.6pYzQ3W0nSCtcVUlRk0SDzm1Tuzty', 'doctor'),
('doctor4', '$2b$10$TE59Pk.PL/uNlZU0TEo6gO0/Yfd3xROPSGL95dnNAi.pErHEZmDwm', 'doctor'),
('doctor5', '$2b$10$mqjq0RnPeRweCTI1pQeXHucSVtrDH/j1C2u4sbnTT2KO6c2wfe0XO', 'doctor'),
('receptionist1', '$2b$10$7hp4sFWC9iDmdiFnc/rmP.YNeXsWYyDiX2FxjlqwVj1tAcyr/IscC', 'receptionist'),
('admin1', '$2b$10$RwlLa35XJs9DkGIqN.8gG.q.MBX3UvSp.wEB/jCukiFLSVM5D7WjK', 'admin');


-- Insert Patients
INSERT INTO patient (user_id, name, dob, gender, phone, email, address, blood_group, medical_history) VALUES
(1, 'John Doe', '1990-05-14', 'Male', '9876543210', 'john.doe@example.com', '123 Elm Street', 'O+', 'No major illnesses'),
(2, 'Jane Smith', '1985-09-22', 'Female', '9876543211', 'jane.smith@example.com', '456 Oak Street', 'A-', 'Diabetic'),
(3, 'Emily Johnson', '1992-11-10', 'Female', '9876543212', 'emily.johnson@example.com', '789 Pine Street', 'B+', 'Allergic to penicillin'),
(4, 'Michael Brown', '1988-03-05', 'Male', '9876543213', 'michael.brown@example.com', '101 Maple Street', 'AB+', 'History of hypertension'),
(5, 'Sarah Wilson', '1995-07-18', 'Female', '9876543214', 'sarah.wilson@example.com', '222 Birch Street', 'O-', 'Asthma patient');

-- Insert Doctors
INSERT INTO doctor (user_id, name, specialization, phone, email, availability) VALUES
(6, 'Dr. Adam White', 'Cardiology', '9876543220', 'adam.white@example.com', '9AM - 5PM'),
(7, 'Dr. Laura Green', 'Dermatology', '9876543221', 'laura.green@example.com', '10AM - 4PM'),
(8, 'Dr. Kevin Black', 'Neurology', '9876543222', 'kevin.black@example.com', '8AM - 2PM'),
(9, 'Dr. Sophia Blue', 'Pediatrics', '9876543223', 'sophia.blue@example.com', '12PM - 6PM'),
(10, 'Dr. David Red', 'Orthopedics', '9876543224', 'david.red@example.com', '7AM - 1PM');

-- Insert Receptionist
INSERT INTO receptionist (user_id, name, email, phone) VALUES
(11, 'Emma receptionist', 'emma.recep@example.com', '9876543250');

-- Insert Admin
INSERT INTO "admin" (user_id, name, email, phone) VALUES
(12, 'Alice admin', 'alice.admin@example.com', '9876543230');

-- Insert Appointments  
INSERT INTO appointment (patient_id, doctor_id, date, time)
VALUES 
(1, 1, '2025-03-31', '10:30:00'),
(2, 2, '2025-04-01', '11:00:00');

-- Insert Medical Records
INSERT INTO medicalrecords (patient_id, doctor_id, appointment_id)
VALUES 
(1, 3, 1),
(2, 4, 2);
