CREATE TABLE patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INT NOT NULL,
    phone VARCHAR(15) NOT NULL,
    address TEXT NOT NULL,
    gender VARCHAR(10) NOT NULL,
    email VARCHAR(100)
);
