-- ===========================================
-- Go Dr Database Schema
-- Version: 2.0
-- Database: PostgreSQL
-- ===========================================

-- ===========================================
-- Drop Existing Tables
-- ===========================================

DROP TABLE IF EXISTS appointment_slots CASCADE;
DROP TABLE IF EXISTS doctor_availability CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS doctor_specialties CASCADE;
DROP TABLE IF EXISTS specialties CASCADE;
DROP TABLE IF EXISTS chambers CASCADE;
DROP TABLE IF EXISTS hospitals CASCADE;
DROP TABLE IF EXISTS doctors CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ===========================================
-- Users Table
-- ===========================================

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,

    full_name VARCHAR(150) NOT NULL,

    email VARCHAR(150) UNIQUE NOT NULL,

    phone VARCHAR(20) UNIQUE NOT NULL,

    password_hash TEXT NOT NULL,

    role VARCHAR(20) NOT NULL
        CHECK (role IN (
            'admin',
            'doctor',
            'patient'
        )),

    is_verified BOOLEAN DEFAULT FALSE,

    is_active BOOLEAN DEFAULT TRUE,

    profile_photo TEXT,

    last_login TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- Users Indexes
-- ===========================================

CREATE INDEX idx_users_email
ON users(email);

CREATE INDEX idx_users_phone
ON users(phone);

CREATE INDEX idx_users_role
ON users(role);

CREATE INDEX idx_users_active
ON users(is_active);

CREATE INDEX idx_users_verified
ON users(is_verified);
-- ===========================================
-- Sample Admin Data
-- ===========================================

INSERT INTO users (
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

-- ===========================================
-- Patients Table
-- ===========================================

CREATE TABLE patients (

    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL UNIQUE,

    first_name VARCHAR(100) NOT NULL,

    last_name VARCHAR(100) NOT NULL,

    gender VARCHAR(20)
        CHECK (gender IN ('male','female','other')),

    date_of_birth DATE,

    blood_group VARCHAR(5)
        CHECK (
            blood_group IN (
                'A+','A-',
                'B+','B-',
                'AB+','AB-',
                'O+','O-'
            )
        ),

    phone VARCHAR(20),

    email VARCHAR(150),

    emergency_contact VARCHAR(20),

    address TEXT,

    profile_photo TEXT,

    height DECIMAL(5,2),

    weight DECIMAL(5,2),

    allergies TEXT,

    chronic_diseases TEXT,

    current_medications TEXT,

    emergency_note TEXT,

    is_verified BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_patient_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- ===========================================
-- Patients Indexes
-- ===========================================

CREATE INDEX idx_patients_user
ON patients(user_id);

CREATE INDEX idx_patients_phone
ON patients(phone);

CREATE INDEX idx_patients_email
ON patients(email);

CREATE INDEX idx_patients_blood_group
ON patients(blood_group);

CREATE INDEX idx_patients_verified
ON patients(is_verified);
-- ===========================================
-- Doctors Table
-- ===========================================

CREATE TABLE doctors (

    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL UNIQUE,

    bmdc_registration_number VARCHAR(100) UNIQUE NOT NULL,

    first_name VARCHAR(100) NOT NULL,

    last_name VARCHAR(100) NOT NULL,

    gender VARCHAR(20)
        CHECK (gender IN ('male','female','other')),

    date_of_birth DATE,

    profile_photo TEXT,

    specialization VARCHAR(150) NOT NULL,

    qualifications TEXT NOT NULL,

    experience_years INTEGER DEFAULT 0
        CHECK (experience_years >= 0),

    consultation_fee NUMERIC(10,2) DEFAULT 0.00
        CHECK (consultation_fee >= 0),

    bio TEXT,

    languages TEXT,

    online_consultation BOOLEAN DEFAULT FALSE,

    is_verified BOOLEAN DEFAULT FALSE,

    average_rating NUMERIC(2,1) DEFAULT 0.0
        CHECK (
            average_rating >= 0
            AND average_rating <= 5
        ),

    total_reviews INTEGER DEFAULT 0
        CHECK (total_reviews >= 0),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_doctor_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- ===========================================
-- Doctors Indexes
-- ===========================================

CREATE INDEX idx_doctors_user
ON doctors(user_id);

CREATE INDEX idx_doctors_bmdc
ON doctors(bmdc_registration_number);

CREATE INDEX idx_doctors_specialization
ON doctors(specialization);

CREATE INDEX idx_doctors_verified
ON doctors(is_verified);

CREATE INDEX idx_doctors_rating
ON doctors(average_rating);

CREATE INDEX idx_doctors_fee
ON doctors(consultation_fee);
-- ===========================================
-- Doctor Performance Indexes
-- ===========================================

CREATE INDEX idx_doctors_experience
ON doctors(experience_years);

CREATE INDEX idx_doctors_online
ON doctors(online_consultation);

CREATE INDEX idx_doctors_name
ON doctors(first_name, last_name);

-- ===========================================
-- Doctor Search Index
-- ===========================================

CREATE INDEX idx_doctors_search
ON doctors (
    specialization,
    experience_years,
    consultation_fee,
    average_rating
);

-- ===========================================
-- Part 1 Completed
-- ===========================================
-- ===========================================
-- Hospitals Table
-- ===========================================

CREATE TABLE hospitals (

    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(255) NOT NULL,

    hospital_type VARCHAR(50)
        CHECK (
            hospital_type IN (
                'Government',
                'Private',
                'Clinic',
                'Diagnostic Center'
            )
        ),

    division VARCHAR(100) NOT NULL,

    district VARCHAR(100) NOT NULL,

    upazila VARCHAR(100),

    address TEXT NOT NULL,

    phone VARCHAR(20),

    email VARCHAR(150) UNIQUE,

    website TEXT,

    latitude DECIMAL(10,8),

    longitude DECIMAL(11,8),

    is_verified BOOLEAN DEFAULT FALSE,

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- Hospital Indexes
-- ===========================================

CREATE INDEX idx_hospital_name
ON hospitals(name);

CREATE INDEX idx_hospital_division
ON hospitals(division);

CREATE INDEX idx_hospital_district
ON hospitals(district);

CREATE INDEX idx_hospital_verified
ON hospitals(is_verified);

CREATE INDEX idx_hospital_active
ON hospitals(is_active);

CREATE INDEX idx_hospital_location
ON hospitals(division, district, upazila);
-- ===========================================
-- Chambers Table
-- ===========================================

CREATE TABLE chambers (

    id BIGSERIAL PRIMARY KEY,

    doctor_id BIGINT NOT NULL,

    hospital_id BIGINT,

    chamber_name VARCHAR(255) NOT NULL,

    address TEXT NOT NULL,

    division VARCHAR(100) NOT NULL,

    district VARCHAR(100) NOT NULL,

    upazila VARCHAR(100),

    room_no VARCHAR(50),

    visiting_days VARCHAR(255),

    start_time TIME,

    end_time TIME,

    appointment_duration INTEGER DEFAULT 20
        CHECK (appointment_duration > 0),

    consultation_fee NUMERIC(10,2) DEFAULT 0.00
        CHECK (consultation_fee >= 0),

    phone VARCHAR(20),

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_chamber_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES doctors(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_chamber_hospital
        FOREIGN KEY (hospital_id)
        REFERENCES hospitals(id)
        ON DELETE SET NULL
);

-- ===========================================
-- Chamber Indexes
-- ===========================================

CREATE INDEX idx_chamber_doctor
ON chambers(doctor_id);

CREATE INDEX idx_chamber_hospital
ON chambers(hospital_id);

CREATE INDEX idx_chamber_division
ON chambers(division);

CREATE INDEX idx_chamber_district
ON chambers(district);

CREATE INDEX idx_chamber_active
ON chambers(is_active);

CREATE INDEX idx_chamber_fee
ON chambers(consultation_fee);

CREATE INDEX idx_chamber_location
ON chambers(division, district, upazila);
-- ===========================================
-- Specialties Table
-- ===========================================

CREATE TABLE specialties (

    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(150) UNIQUE NOT NULL,

    description TEXT,

    icon TEXT,

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- Specialty Indexes
-- ===========================================

CREATE INDEX idx_specialty_name
ON specialties(name);

CREATE INDEX idx_specialty_active
ON specialties(is_active);

-- ===========================================
-- Doctor Specialties Table
-- ===========================================

CREATE TABLE doctor_specialties (

    id BIGSERIAL PRIMARY KEY,

    doctor_id BIGINT NOT NULL,

    specialty_id BIGINT NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ds_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES doctors(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_ds_specialty
        FOREIGN KEY (specialty_id)
        REFERENCES specialties(id)
        ON DELETE CASCADE,

    CONSTRAINT unique_doctor_specialty
        UNIQUE (doctor_id, specialty_id)
);

-- ===========================================
-- Doctor Specialty Indexes
-- ===========================================

CREATE INDEX idx_ds_doctor
ON doctor_specialties(doctor_id);

CREATE INDEX idx_ds_specialty
ON doctor_specialties(specialty_id);
-- ===========================================
-- Default Specialties
-- ===========================================

INSERT INTO specialties (name, description)
VALUES
('Medicine','General Medicine Specialist'),
('Cardiology','Heart Specialist'),
('Neurology','Brain and Nervous System Specialist'),
('Orthopedics','Bone and Joint Specialist'),
('Gynecology','Women Health Specialist'),
('Pediatrics','Child Specialist'),
('Dermatology','Skin Specialist'),
('Psychiatry','Mental Health Specialist'),
('Ophthalmology','Eye Specialist'),
('ENT','Ear, Nose and Throat Specialist'),
('Urology','Urinary System Specialist'),
('Nephrology','Kidney Specialist'),
('Gastroenterology','Digestive System Specialist'),
('Endocrinology','Hormone and Diabetes Specialist'),
('Pulmonology','Lung Specialist'),
('Oncology','Cancer Specialist'),
('Dentistry','Dental Specialist'),
('General Surgery','General Surgeon'),
('Anesthesiology','Anesthesia Specialist'),
('Radiology','Medical Imaging Specialist');
-- ===========================================
-- Appointments Table
-- ===========================================

CREATE TABLE appointments (

    id BIGSERIAL PRIMARY KEY,

    patient_id BIGINT NOT NULL,

    doctor_id BIGINT NOT NULL,

    chamber_id BIGINT NOT NULL,

    appointment_date DATE NOT NULL,

    appointment_time TIME NOT NULL,

    serial_number INTEGER,

    visit_type VARCHAR(20)
        CHECK (
            visit_type IN (
                'Online',
                'Offline'
            )
        ),

    status VARCHAR(20)
        DEFAULT 'Pending'
        CHECK (
            status IN (
                'Pending',
                'Confirmed',
                'Completed',
                'Cancelled',
                'Rejected',
                'No Show'
            )
        ),

    patient_problem TEXT,

    doctor_notes TEXT,

    prescription_url TEXT,

    booked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_appointment_patient
        FOREIGN KEY (patient_id)
        REFERENCES users(id)
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

-- ===========================================
-- Appointment Indexes
-- ===========================================

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

CREATE INDEX idx_appointments_serial
ON appointments(serial_number);
-- ===========================================
-- Reviews Table
-- ===========================================

CREATE TABLE reviews (

    id BIGSERIAL PRIMARY KEY,

    patient_id BIGINT NOT NULL,

    doctor_id BIGINT NOT NULL,

    appointment_id BIGINT,

    rating INTEGER NOT NULL
        CHECK (rating BETWEEN 1 AND 5),

    review_title VARCHAR(255),

    review_text TEXT,

    is_anonymous BOOLEAN DEFAULT FALSE,

    is_verified BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_review_patient
        FOREIGN KEY (patient_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_review_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES doctors(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_review_appointment
        FOREIGN KEY (appointment_id)
        REFERENCES appointments(id)
        ON DELETE SET NULL
);

-- ===========================================
-- Review Indexes
-- ===========================================

CREATE INDEX idx_reviews_patient
ON reviews(patient_id);

CREATE INDEX idx_reviews_doctor
ON reviews(doctor_id);

CREATE INDEX idx_reviews_appointment
ON reviews(appointment_id);

CREATE INDEX idx_reviews_rating
ON reviews(rating);

CREATE INDEX idx_reviews_verified
ON reviews(is_verified);

CREATE INDEX idx_reviews_created
ON reviews(created_at);
-- ===========================================
-- Notifications Table
-- ===========================================

CREATE TABLE notifications (

    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL,

    title VARCHAR(255) NOT NULL,

    message TEXT NOT NULL,

    notification_type VARCHAR(50)
        CHECK (
            notification_type IN (
                'Appointment',
                'Reminder',
                'System',
                'Review',
                'Verification',
                'Promotion'
            )
        ),

    is_read BOOLEAN DEFAULT FALSE,

    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    read_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_notification_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- ===========================================
-- Notification Indexes
-- ===========================================

CREATE INDEX idx_notifications_user
ON notifications(user_id);

CREATE INDEX idx_notifications_read
ON notifications(is_read);

CREATE INDEX idx_notifications_type
ON notifications(notification_type);

CREATE INDEX idx_notifications_sent
ON notifications(sent_at);

CREATE INDEX idx_notifications_user_read
ON notifications(user_id, is_read);
-- ===========================================
-- Doctor Availability Table
-- ===========================================

CREATE TABLE doctor_availability (

    id BIGSERIAL PRIMARY KEY,

    doctor_id BIGINT NOT NULL,

    chamber_id BIGINT NOT NULL,

    day_of_week VARCHAR(20) NOT NULL
        CHECK (
            day_of_week IN (
                'Sunday',
                'Monday',
                'Tuesday',
                'Wednesday',
                'Thursday',
                'Friday',
                'Saturday'
            )
        ),

    start_time TIME NOT NULL,

    end_time TIME NOT NULL,

    slot_duration_minutes INTEGER DEFAULT 20
        CHECK (slot_duration_minutes > 0),

    max_patients INTEGER DEFAULT 30
        CHECK (max_patients > 0),

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_availability_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES doctors(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_availability_chamber
        FOREIGN KEY (chamber_id)
        REFERENCES chambers(id)
        ON DELETE CASCADE
);

-- ===========================================
-- Doctor Availability Indexes
-- ===========================================

CREATE INDEX idx_availability_doctor
ON doctor_availability(doctor_id);

CREATE INDEX idx_availability_chamber
ON doctor_availability(chamber_id);

CREATE INDEX idx_availability_day
ON doctor_availability(day_of_week);

CREATE INDEX idx_availability_active
ON doctor_availability(is_active);

CREATE INDEX idx_availability_doctor_day
ON doctor_availability(doctor_id, day_of_week);
-- ===========================================
-- Appointment Slots Table
-- ===========================================

CREATE TABLE appointment_slots (

    id BIGSERIAL PRIMARY KEY,

    availability_id BIGINT NOT NULL,

    slot_date DATE NOT NULL,

    start_time TIME NOT NULL,

    end_time TIME NOT NULL,

    is_booked BOOLEAN DEFAULT FALSE,

    appointment_id BIGINT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_slot_availability
        FOREIGN KEY (availability_id)
        REFERENCES doctor_availability(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_slot_appointment
        FOREIGN KEY (appointment_id)
        REFERENCES appointments(id)
        ON DELETE SET NULL,

    )CONSTRAINT chk_slot_time
CHECK (start_time < end_time),

CONSTRAINT unique_slot
UNIQUE (
    availability_id,
    slot_date,
    start_time
)

-- ===========================================
-- Appointment Slot Indexes
-- ===========================================

CREATE INDEX idx_slots_availability
ON appointment_slots(availability_id);

CREATE INDEX idx_slots_date
ON appointment_slots(slot_date);

CREATE INDEX idx_slots_booked
ON appointment_slots(is_booked);

CREATE INDEX idx_slots_appointment
ON appointment_slots(appointment_id);

CREATE INDEX idx_slots_date_time
ON appointment_slots(slot_date, start_time);

CREATE INDEX idx_slots_availability_date
ON appointment_slots(availability_id, slot_date);
-- ===========================================
-- Auto Update updated_at Trigger Function
-- ===========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS
$$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- Users Trigger
-- ===========================================

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- Patients Trigger
-- ===========================================

CREATE TRIGGER trg_patients_updated_at
BEFORE UPDATE ON patients
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- Doctors Trigger
-- ===========================================

CREATE TRIGGER trg_doctors_updated_at
BEFORE UPDATE ON doctors
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- Hospitals Trigger
-- ===========================================

CREATE TRIGGER trg_hospitals_updated_at
BEFORE UPDATE ON hospitals
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- Chambers Trigger
-- ===========================================

CREATE TRIGGER trg_chambers_updated_at
BEFORE UPDATE ON chambers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- Specialties Trigger
-- ===========================================

CREATE TRIGGER trg_specialties_updated_at
BEFORE UPDATE ON specialties
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- Appointments Trigger
-- ===========================================

CREATE TRIGGER trg_appointments_updated_at
BEFORE UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- Reviews Trigger
-- ===========================================

CREATE TRIGGER trg_reviews_updated_at
BEFORE UPDATE ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- Doctor Availability Trigger
-- ===========================================

CREATE TRIGGER trg_doctor_availability_updated_at
BEFORE UPDATE ON doctor_availability
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- Appointment Slots Trigger
-- ===========================================

CREATE TRIGGER trg_appointment_slots_updated_at
BEFORE UPDATE ON appointment_slots
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
