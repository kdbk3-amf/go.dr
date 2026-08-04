-- ===========================================
-- Go Dr Database Schema
-- Version: 1.0
-- Database: PostgreSQL
-- ===========================================

-- Drop table if it already exists
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
        CHECK (role IN ('admin', 'doctor', 'patient')),

    is_verified BOOLEAN DEFAULT FALSE,

    is_active BOOLEAN DEFAULT TRUE,

    profile_photo TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- Indexes
-- ===========================================

CREATE INDEX idx_users_email
ON users(email);

CREATE INDEX idx_users_phone
ON users(phone);

CREATE INDEX idx_users_role
ON users(role);

-- ===========================================
-- Sample Data (Optional)
-- ===========================================

INSERT INTO users (
    full_name,
    email,
    phone,
    password_hash,
    role,
    is_verified
)
VALUES
(
    'System Administrator',
    'admin@godr.com',
    '01700000000',
    'CHANGE_WITH_HASHED_PASSWORD',
    'admin',
    TRUE
);-- ===========================================
-- Doctors Table
-- ===========================================

CREATE TABLE doctors (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL UNIQUE,

    bmdc_registration_number VARCHAR(100) UNIQUE NOT NULL,

    first_name VARCHAR(100) NOT NULL,

    last_name VARCHAR(100) NOT NULL,

    gender VARCHAR(20)
        CHECK (gender IN ('male', 'female', 'other')),

    date_of_birth DATE,

    profile_photo TEXT,

    specialization VARCHAR(150) NOT NULL,

    qualifications TEXT NOT NULL,

    experience_years INTEGER DEFAULT 0,

    consultation_fee NUMERIC(10,2) DEFAULT 0.00,

    bio TEXT,

    languages TEXT,

    online_consultation BOOLEAN DEFAULT FALSE,

    is_verified BOOLEAN DEFAULT FALSE,

    average_rating NUMERIC(2,1) DEFAULT 0.0,

    total_reviews INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_doctor_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);
-- ===========================================
-- Hospitals Table
-- ===========================================

CREATE TABLE hospitals (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(255) NOT NULL,

    hospital_type VARCHAR(50)
        CHECK (hospital_type IN ('Government', 'Private', 'Clinic', 'Diagnostic Center')),

    division VARCHAR(100) NOT NULL,

    district VARCHAR(100) NOT NULL,

    upazila VARCHAR(100),

    address TEXT NOT NULL,

    phone VARCHAR(20),

    email VARCHAR(150),

    website TEXT,

    latitude DECIMAL(10,8),

    longitude DECIMAL(11,8),

    is_verified BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

    appointment_duration INTEGER DEFAULT 20,

    consultation_fee NUMERIC(10,2),

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
);-- ===========================================
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
-- Default Specialties
-- ===========================================

INSERT INTO specialties (name, description)
VALUES
('Medicine', 'General Medicine Specialist'),
('Cardiology', 'Heart Specialist'),
('Neurology', 'Brain and Nervous System Specialist'),
('Orthopedics', 'Bone and Joint Specialist'),
('Gynecology', 'Women Health Specialist'),
('Pediatrics', 'Child Specialist'),
('Dermatology', 'Skin Specialist'),
('Psychiatry', 'Mental Health Specialist'),
('Ophthalmology', 'Eye Specialist'),
('ENT', 'Ear, Nose and Throat Specialist'),
('Urology', 'Urinary System Specialist'),
('Nephrology', 'Kidney Specialist'),
('Gastroenterology', 'Digestive System Specialist'),
('Endocrinology', 'Hormone and Diabetes Specialist'),
('Pulmonology', 'Lung Specialist'),
('Oncology', 'Cancer Specialist'),
('Dentistry', 'Dental Specialist'),
('General Surgery', 'General Surgeon'),
('Anesthesiology', 'Anesthesia Specialist'),
('Radiology', 'Medical Imaging Specialist');-- ===========================================
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
        CHECK (visit_type IN ('Online', 'Offline')),

    status VARCHAR(20) DEFAULT 'Pending'
        CHECK (status IN (
            'Pending',
            'Confirmed',
            'Completed',
            'Cancelled',
            'Rejected',
            'No Show'
        )),

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
-- Indexes
-- ===========================================

CREATE INDEX idx_appointments_patient
ON appointments(patient_id);-- ===========================================
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
-- Indexes
-- ===========================================

CREATE INDEX idx_reviews_doctor
ON reviews(doctor_id);

CREATE INDEX idx_reviews_patient
ON reviews(patient_id);

CREATE INDEX idx_reviews_rating
ON reviews(rating);-- ===========================================
-- Notifications Table
-- ===========================================

CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL,

    title VARCHAR(255) NOT NULL,

    message TEXT NOT NULL,

    notification_type VARCHAR(50)
        CHECK (notification_type IN (
            'Appointment',
            'Reminder',
            'System',
            'Review',
            'Verification',
            'Promotion'
        )),

    is_read BOOLEAN DEFAULT FALSE,

    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    read_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_notification_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- ===========================================
-- Indexes
-- ===========================================

CREATE INDEX idx_notifications_user
ON notifications(user_id);

CREATE INDEX idx_notifications_read
ON notifications(is_read);

CREATE INDEX idx_notifications_type
ON notifications(notification_type);

CREATE INDEX idx_appointments_doctor
ON appointments(doctor_id);

CREATE INDEX idx_appointments_date
ON appointments(appointment_date);

CREATE INDEX idx_appointments_status
ON appointments(status);-- ===========================================
-- Doctor Availability Table
-- ===========================================

CREATE TABLE doctor_availability (
    id BIGSERIAL PRIMARY KEY,

    doctor_id BIGINT NOT NULL,

    chamber_id BIGINT NOT NULL,

    day_of_week VARCHAR(20) NOT NULL
        CHECK (day_of_week IN (
            'Sunday',
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday'
        )),

    start_time TIME NOT NULL,

    end_time TIME NOT NULL,

    slot_duration_minutes INTEGER DEFAULT 20,

    max_patients INTEGER DEFAULT 30,

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

    CONSTRAINT fk_slot_availability
        FOREIGN KEY (availability_id)
        REFERENCES doctor_availability(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_slot_appointment
        FOREIGN KEY (appointment_id)
        REFERENCES appointments(id)
        ON DELETE SET NULL
);

-- ===========================================
-- Indexes
-- ===========================================

CREATE INDEX idx_availability_doctor
ON doctor_availability(doctor_id);

CREATE INDEX idx_slot_date
ON appointment_slots(slot_date);

CREATE INDEX idx_slot_booked
ON appointment_slots(is_booked);
