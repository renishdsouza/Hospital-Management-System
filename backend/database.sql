-- Drop existing tables if they exist (to avoid conflicts)
DROP TABLE IF EXISTS medicalrecords, appointment, patient, doctor, receptionist, admin, "user" CASCADE;

-- Drop ENUM types if they already exist
DROP TYPE IF EXISTS user_role, gender_type, appointment_status;

-- Create ENUM types
CREATE TYPE user_role AS ENUM ('admin', 'doctor', 'receptionist', 'patient');
CREATE TYPE gender_type AS ENUM ('Male', 'Female', 'Other');
CREATE TYPE appointment_status AS ENUM ('Scheduled', 'Completed', 'Cancelled');

-- User Table
CREATE TABLE "user" (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role user_role NOT NULL
);

-- Patient Table
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
CREATE TABLE receptionist (
    receptionist_id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100)  NOT NULL,
    phone VARCHAR(15)  NOT NULL,
    FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE CASCADE
);

-- Admin Table
CREATE TABLE admin (
    admin_id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100)  NOT NULL,
    phone VARCHAR(15)  NOT NULL,
    FOREIGN KEY (user_id) REFERENCES "user"(user_id) ON DELETE CASCADE
);

-- Appointment Table
CREATE TABLE appointment (
    appointment_id SERIAL PRIMARY KEY,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    date DATE NOT NULL,
    time TIME NOT NULL DEFAULT '00:00:00',
    status appointment_status NOT NULL DEFAULT 'Scheduled',
    FOREIGN KEY (patient_id) REFERENCES patient(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctor(doctor_id) ON DELETE CASCADE
);

-- Medical Records Table
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

INSERT INTO "user" (username, password, role) VALUES
('patient1', 'pass1', 'patient'),
('patient2', 'pass2', 'patient'),
('patient3', 'pass3', 'patient'),
('patient4', 'pass4', 'patient'),
('patient5', 'pass5', 'patient'),
('doctor1', 'docpass1', 'doctor'),
('doctor2', 'docpass2', 'doctor'),
('doctor3', 'docpass3', 'doctor'),
('doctor4', 'docpass4', 'doctor'),
('doctor5', 'docpass5', 'doctor'),
('receptionist1', 'receppass1', 'receptionist'),
('admin1', 'adminpass1', 'admin');

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
