# 🏥 Hospital_Management_System

Building a Hospital Management System for our course project using **PostgreSQL**, **Node.js**, **Express.js**, **EJS**, and more.

> 📁 Only the `backend` folder contains the files necessary to run the project. All other files outside this folder are not required.

---

## 🚀 How to Run the Project

Follow the steps below to set up and run the project locally:

### ✅ Step-by-Step Instructions

1. **Clone the Repository**

    ```bash
    git clone https://github.com/yourusername/Hospital_Management_System.git
    ```

2. **Navigate to the Backend Directory**

    ```bash
    cd Hospital_Management_System/backend
    ```

3. **Set Up Environment Variables**

    Create a `.env` file in the `backend` directory and add the following:

    ```env
    DB_USER=yourdbuser
    DB_HOST=localhost
    DB_NAME=databasename
    DB_PASSWORD=yourpassword
    DB_PORT=portno
    ```

    - `DB_USER`   : Your PostgreSQL username  
    - `DB_HOST`   : Typically `localhost`  
    - `DB_NAME`   : The name of your database  
    - `DB_PASSWORD` : Your PostgreSQL password  
    - `DB_PORT`   : Default is usually `5432`

4. **Install Dependencies**

    Run the following command to install all Node.js dependencies:

    ```bash
    npm install
    ```

5. **Start the Server**

    Run the server using `nodemon`:

    ```bash
    nodemon index.js
    ```

    > If `nodemon` is not installed globally, you can install it with:

    ```bash
    npm install -g nodemon
    ```
    > You can also install it locally instead of locally by removing the -g flag from above:

---

## 📁 Project Structure

```text
Hospital_Management_System/
├── backend/                   # Backend logic (Express.js, PostgreSQL)
│   ├── public/               # Static files (CSS, JS)
│   ├── views/                # EJS templates for frontend rendering
│   ├── .env                  # Environment variables file
│   ├── index.js              # Entry point of the backend server
│ 
├── README.md                 # Root project documentation


## For Contributing:
Create a pull request with detailed explanation of the feature and it's use we will review it at our earliest and get back to you.Also you can check the issues raised and work upon them and raise a pull request linked with the issue


