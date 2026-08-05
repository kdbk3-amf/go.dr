-- ==========================================================
-- Go Dr Database Schema
-- Version : 1.0 (Minimal Production Ready)
-- Database: PostgreSQL
-- ==========================================================

-- ==========================================================
-- EXTENSIONS
-- ==========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================================
-- DROP TABLES
-- ==========================================================

DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS chambers CASCADE;
DROP TABLE IF EXISTS hospitals CASCADE;
DROP TABLE IF EXISTS doctors CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ==========================================================
-- USERS TABLE
-- ==========================================================

CREATE TABLE users (

    id BIGSERIAL PRIMARY KEY,

    uuid UUID NOT NULL
        DEFAULT uuid_generate_v4(),

    full_name VARCHAR(150) NOT NULL,

    email VARCHAR(150)
        UNIQUE NOT NULL,

    phone VARCHAR(20)
        UNIQUE NOT NULL,

    password_hash TEXT NOT NULL,

    role VARCHAR(20) NOT NULL
        CHECK (
            role IN (
                'admin',
                'doctor',
                'patient'
            )
        ),

    profile_photo TEXT,

    is_verified BOOLEAN
        DEFAULT FALSE,

    is_active BOOLEAN
        DEFAULT TRUE,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- USERS INDEXES
-- ==========================================================

CREATE INDEX idx_users_email
ON users(email);

CREATE INDEX idx_users_phone
ON users(phone);

CREATE INDEX idx_users_role
ON users(role);

CREATE INDEX idx_users_active
ON users(is_active);

-- ==========================================================
-- DEFAULT ADMIN
-- ==========================================================

INSERT INTO users
(
    full_name,
    email,
    phone,
    password_hash,
    role,
    is_verified,
    is_active
)
VALUES
(
    'System Administrator',
    'admin@godr.com',
    '01700000000',
    'CHANGE_WITH_HASHED_PASSWORD',
    'admin',
    TRUE,
    TRUE
);

-- ==========================================================
-- End of Part 1
-- ==========================================================
-- ==========================================================
-- PATIENTS TABLE
-- ==========================================================

CREATE TABLE patients (

    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL UNIQUE,

    date_of_birth DATE,

    gender VARCHAR(10)
        CHECK (
            gender IN (
                'male',
                'female',
                'other'
            )
        ),

    blood_group VARCHAR(5)
        CHECK (
            blood_group IN (
                'A+','A-',
                'B+','B-',
                'AB+','AB-',
                'O+','O-'
            )
        ),

    address TEXT,

    emergency_contact_name VARCHAR(150),

    emergency_contact_phone VARCHAR(20),

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_patient_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- ==========================================================
-- PATIENTS INDEXES
-- ==========================================================

CREATE INDEX idx_patients_user
ON patients(user_id);

CREATE INDEX idx_patients_gender
ON patients(gender);

CREATE INDEX idx_patients_blood_group
ON patients(blood_group);

-- ==========================================================
-- DOCTORS TABLE
-- ==========================================================

CREATE TABLE doctors (

    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL UNIQUE,

    specialization VARCHAR(150) NOT NULL,

    qualification TEXT NOT NULL,

    experience_years INTEGER
        DEFAULT 0
        CHECK (experience_years >= 0),

    consultation_fee NUMERIC(10,2)
        DEFAULT 0.00
        CHECK (consultation_fee >= 0),

    bio TEXT,

    is_verified BOOLEAN
        DEFAULT FALSE,

    is_available BOOLEAN
        DEFAULT TRUE,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_doctor_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- ==========================================================
-- DOCTORS INDEXES
-- ==========================================================

CREATE INDEX idx_doctors_user
ON doctors(user_id);

CREATE INDEX idx_doctors_specialization
ON doctors(specialization);

CREATE INDEX idx_doctors_verified
ON doctors(is_verified);

CREATE INDEX idx_doctors_available
ON doctors(is_available);

-- ==========================================================
-- End of Part 2
-- ==========================================================
-- ==========================================================
-- HOSPITALS TABLE
-- ==========================================================

CREATE TABLE hospitals (

    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(200) NOT NULL,

    address TEXT NOT NULL,

    phone VARCHAR(20),

    email VARCHAR(150),

    website TEXT,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- HOSPITALS INDEXES
-- ==========================================================

CREATE INDEX idx_hospitals_name
ON hospitals(name);

CREATE INDEX idx_hospitals_phone
ON hospitals(phone);

-- ==========================================================
-- CHAMBERS TABLE
-- ==========================================================

CREATE TABLE chambers (

    id BIGSERIAL PRIMARY KEY,

    doctor_id BIGINT NOT NULL,

    hospital_id BIGINT NOT NULL,

    chamber_name VARCHAR(200) NOT NULL,

    address TEXT NOT NULL,

    visiting_days VARCHAR(100) NOT NULL,

    start_time TIME NOT NULL,

    end_time TIME NOT NULL,

    consultation_fee NUMERIC(10,2)
        DEFAULT 0.00
        CHECK (consultation_fee >= 0),

    is_active BOOLEAN
        DEFAULT TRUE,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_chamber_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES doctors(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_chamber_hospital
        FOREIGN KEY (hospital_id)
        REFERENCES hospitals(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_chamber_time
        CHECK (start_time < end_time)
);

-- ==========================================================
-- CHAMBERS INDEXES
-- ==========================================================

CREATE INDEX idx_chambers_doctor
ON chambers(doctor_id);

CREATE INDEX idx_chambers_hospital
ON chambers(hospital_id);

CREATE INDEX idx_chambers_active
ON chambers(is_active);

-- ==========================================================
-- End of Part 3
-- ==========================================================
-- ==========================================================
-- APPOINTMENTS TABLE
-- ==========================================================

CREATE TABLE appointments (

    id BIGSERIAL PRIMARY KEY,

    appointment_number VARCHAR(30)
        UNIQUE NOT NULL,

    patient_id BIGINT NOT NULL,

    doctor_id BIGINT NOT NULL,

    chamber_id BIGINT NOT NULL,

    appointment_date DATE NOT NULL,

    appointment_time TIME NOT NULL,

    status VARCHAR(20)
        DEFAULT 'Pending'
        CHECK (
            status IN (
                'Pending',
                'Confirmed',
                'Completed',
                'Cancelled'
            )
        ),

    patient_problem TEXT,

    doctor_notes TEXT,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_appointment_patient
        FOREIGN KEY (patient_id)
        REFERENCES patients(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_appointment_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES doctors(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_appointment_chamber
        FOREIGN KEY (chamber_id)
        REFERENCES chambers(id)
        ON DELETE CASCADE
);

-- ==========================================================
-- APPOINTMENTS INDEXES
-- ==========================================================

CREATE INDEX idx_appointments_number
ON appointments(appointment_number);

CREATE INDEX idx_appointments_patient
ON appointments(patient_id);

CREATE INDEX idx_appointments_doctor
ON appointments(doctor_id);

CREATE INDEX idx_appointments_chamber
ON appointments(chamber_id);

CREATE INDEX idx_appointments_date
ON appointments(appointment_date);

CREATE INDEX idx_appointments_status
ON appointments(status);

-- ==========================================================
-- End of Part 4
-- ==========================================================
-- ==========================================================
-- REVIEWS TABLE
-- ==========================================================

CREATE TABLE reviews (

    id BIGSERIAL PRIMARY KEY,

    appointment_id BIGINT NOT NULL UNIQUE,

    patient_id BIGINT NOT NULL,

    doctor_id BIGINT NOT NULL,

    rating INTEGER NOT NULL
        CHECK (rating BETWEEN 1 AND 5),

    review TEXT,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_review_appointment
        FOREIGN KEY (appointment_id)
        REFERENCES appointments(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_review_patient
        FOREIGN KEY (patient_id)
        REFERENCES patients(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_review_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES doctors(id)
        ON DELETE CASCADE
);

-- ==========================================================
-- REVIEWS INDEXES
-- ==========================================================

CREATE INDEX idx_reviews_doctor
ON reviews(doctor_id);

CREATE INDEX idx_reviews_patient
ON reviews(patient_id);

CREATE INDEX idx_reviews_rating
ON reviews(rating);

-- ==========================================================
-- NOTIFICATIONS TABLE
-- ==========================================================

CREATE TABLE notifications (

    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL,

    title VARCHAR(200) NOT NULL,

    message TEXT NOT NULL,

    is_read BOOLEAN
        DEFAULT FALSE,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_notification_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- ==========================================================
-- NOTIFICATIONS INDEXES
-- ==========================================================

CREATE INDEX idx_notifications_user
ON notifications(user_id);

CREATE INDEX idx_notifications_read
ON notifications(is_read);

-- ==========================================================
-- End of Part 5
-- ==========================================================
-- ==========================================================
-- AUTO UPDATE updated_at FUNCTION
-- ==========================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS
$$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$
LANGUAGE plpgsql;

-- ==========================================================
-- USERS TRIGGER
-- ==========================================================

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ==========================================================
-- PATIENTS TRIGGER
-- ==========================================================

CREATE TRIGGER trg_patients_updated_at
BEFORE UPDATE ON patients
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ==========================================================
-- DOCTORS TRIGGER
-- ==========================================================

CREATE TRIGGER trg_doctors_updated_at
BEFORE UPDATE ON doctors
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ==========================================================
-- HOSPITALS TRIGGER
-- ==========================================================

CREATE TRIGGER trg_hospitals_updated_at
BEFORE UPDATE ON hospitals
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ==========================================================
-- CHAMBERS TRIGGER
-- ==========================================================

CREATE TRIGGER trg_chambers_updated_at
BEFORE UPDATE ON chambers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ==========================================================
-- APPOINTMENTS TRIGGER
-- ==========================================================

CREATE TRIGGER trg_appointments_updated_at
BEFORE UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ==========================================================
-- REVIEWS TRIGGER
-- ==========================================================

CREATE TRIGGER trg_reviews_updated_at
BEFORE UPDATE ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ==========================================================
-- NOTIFICATIONS TRIGGER
-- ==========================================================

CREATE TRIGGER trg_notifications_updated_at
BEFORE UPDATE ON notifications
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ==========================================================
-- END OF SCHEMA
-- Version : 1.0
-- Database: PostgreSQL
-- Status  : Minimal Production Ready
-- ==========================================================
