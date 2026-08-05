-- ==========================================================
-- Go Dr Database Schema
-- Version: 2.1 (Production Ready)
-- Database: PostgreSQL
-- Author: OpenAI
-- ==========================================================

-- ==========================================================
-- Extensions
-- ==========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================================
-- Drop Existing Tables
-- ==========================================================

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS otp_verifications CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS prescriptions CASCADE;
DROP TABLE IF EXISTS medical_records CASCADE;
DROP TABLE IF EXISTS appointment_slots CASCADE;
DROP TABLE IF EXISTS doctor_availability CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS doctor_specialties CASCADE;
DROP TABLE IF EXISTS specialties CASCADE;
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

    email VARCHAR(150) NOT NULL UNIQUE,

    phone VARCHAR(20) NOT NULL UNIQUE,

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

    is_verified BOOLEAN NOT NULL DEFAULT FALSE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    last_login TIMESTAMP,

    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- USERS INDEXES
-- ==========================================================

CREATE INDEX idx_users_uuid
ON users(uuid);

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

CREATE INDEX idx_users_created
ON users(created_at);

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

    patient_code VARCHAR(30) UNIQUE,

    first_name VARCHAR(100) NOT NULL,

    last_name VARCHAR(100) NOT NULL,

    gender VARCHAR(20)
        CHECK (
            gender IN (
                'male',
                'female',
                'other'
            )
        ),

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

    marital_status VARCHAR(20)
        CHECK (
            marital_status IN (
                'Single',
                'Married',
                'Divorced',
                'Widowed'
            )
        ),

    national_id VARCHAR(30),

    passport_number VARCHAR(30),

    phone VARCHAR(20),

    email VARCHAR(150),

    emergency_contact_name VARCHAR(150),

    emergency_contact_phone VARCHAR(20),

    emergency_contact_relation VARCHAR(100),

    division VARCHAR(100),

    district VARCHAR(100),

    upazila VARCHAR(100),

    address TEXT,

    profile_photo TEXT,

    height DECIMAL(5,2)
        CHECK (height > 0),

    weight DECIMAL(5,2)
        CHECK (weight > 0),

    allergies TEXT,

    chronic_diseases TEXT,

    current_medications TEXT,

    medical_history TEXT,

    emergency_note TEXT,

    is_verified BOOLEAN DEFAULT FALSE,

    is_active BOOLEAN DEFAULT TRUE,

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
-- PATIENT INDEXES
-- ==========================================================

CREATE INDEX idx_patients_user
ON patients(user_id);

CREATE INDEX idx_patients_code
ON patients(patient_code);

CREATE INDEX idx_patients_phone
ON patients(phone);

CREATE INDEX idx_patients_email
ON patients(email);

CREATE INDEX idx_patients_blood
ON patients(blood_group);

CREATE INDEX idx_patients_division
ON patients(division);

CREATE INDEX idx_patients_district
ON patients(district);

CREATE INDEX idx_patients_verified
ON patients(is_verified);

CREATE INDEX idx_patients_active
ON patients(is_active);

CREATE INDEX idx_patients_name
ON patients(first_name, last_name);

CREATE INDEX idx_patients_location
ON patients(division, district, upazila);

-- ==========================================================
-- End of Part 2
-- ==========================================================
-- ==========================================================
-- DOCTORS TABLE
-- ==========================================================

CREATE TABLE doctors (

    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL UNIQUE,

    doctor_code VARCHAR(30) UNIQUE,

    bmdc_registration_number VARCHAR(100)
        NOT NULL UNIQUE,

    first_name VARCHAR(100) NOT NULL,

    last_name VARCHAR(100) NOT NULL,

    gender VARCHAR(20)
        CHECK (
            gender IN (
                'male',
                'female',
                'other'
            )
        ),

    date_of_birth DATE,

    profile_photo TEXT,

    specialization VARCHAR(150) NOT NULL,

    qualifications TEXT NOT NULL,

    experience_years INTEGER
        DEFAULT 0
        CHECK (experience_years >= 0),

    consultation_fee NUMERIC(10,2)
        DEFAULT 0.00
        CHECK (consultation_fee >= 0),

    bio TEXT,

    languages TEXT,

    education TEXT,

    awards TEXT,

    memberships TEXT,

    license_expiry_date DATE,

    online_consultation BOOLEAN
        DEFAULT FALSE,

    physical_consultation BOOLEAN
        DEFAULT TRUE,

    is_verified BOOLEAN
        DEFAULT FALSE,

    is_available BOOLEAN
        DEFAULT TRUE,

    average_rating NUMERIC(2,1)
        DEFAULT 0.0
        CHECK (
            average_rating >= 0
            AND average_rating <= 5
        ),

    total_reviews INTEGER
        DEFAULT 0
        CHECK (total_reviews >= 0),

    total_patients INTEGER
        DEFAULT 0
        CHECK (total_patients >= 0),

    total_consultations INTEGER
        DEFAULT 0
        CHECK (total_consultations >= 0),

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
-- DOCTOR INDEXES
-- ==========================================================

CREATE INDEX idx_doctors_user
ON doctors(user_id);

CREATE INDEX idx_doctors_code
ON doctors(doctor_code);

CREATE INDEX idx_doctors_bmdc
ON doctors(bmdc_registration_number);

CREATE INDEX idx_doctors_specialization
ON doctors(specialization);

CREATE INDEX idx_doctors_experience
ON doctors(experience_years);

CREATE INDEX idx_doctors_fee
ON doctors(consultation_fee);

CREATE INDEX idx_doctors_rating
ON doctors(average_rating);

CREATE INDEX idx_doctors_verified
ON doctors(is_verified);

CREATE INDEX idx_doctors_available
ON doctors(is_available);

CREATE INDEX idx_doctors_online
ON doctors(online_consultation);

CREATE INDEX idx_doctors_name
ON doctors(first_name, last_name);

CREATE INDEX idx_doctors_search
ON doctors(
    specialization,
    experience_years,
    consultation_fee,
    average_rating
);

-- ==========================================================
-- End of Part 3
-- ==========================================================
-- ==========================================================
-- HOSPITALS TABLE
-- ==========================================================

CREATE TABLE hospitals (

    id BIGSERIAL PRIMARY KEY,

    hospital_code VARCHAR(30) UNIQUE,

    name VARCHAR(255) NOT NULL,

    hospital_type VARCHAR(50)
        CHECK (
            hospital_type IN (
                'Government',
                'Private',
                'Clinic',
                'Diagnostic Center',
                'Medical College Hospital',
                'Specialized Hospital'
            )
        ),

    division VARCHAR(100) NOT NULL,

    district VARCHAR(100) NOT NULL,

    upazila VARCHAR(100),

    area VARCHAR(150),

    address TEXT NOT NULL,

    phone VARCHAR(20),

    emergency_phone VARCHAR(20),

    ambulance_phone VARCHAR(20),

    email VARCHAR(150) UNIQUE,

    website TEXT,

    latitude DECIMAL(10,8),

    longitude DECIMAL(11,8),

    opening_time TIME,

    closing_time TIME,

    emergency_service BOOLEAN DEFAULT TRUE,

    online_report BOOLEAN DEFAULT FALSE,

    description TEXT,

    logo TEXT,

    cover_photo TEXT,

    is_verified BOOLEAN DEFAULT FALSE,

    is_active BOOLEAN DEFAULT TRUE,

    average_rating NUMERIC(2,1)
        DEFAULT 0.0
        CHECK (
            average_rating >= 0
            AND average_rating <= 5
        ),

    total_reviews INTEGER
        DEFAULT 0
        CHECK (total_reviews >= 0),

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- HOSPITAL INDEXES
-- ==========================================================

CREATE INDEX idx_hospitals_code
ON hospitals(hospital_code);

CREATE INDEX idx_hospitals_name
ON hospitals(name);

CREATE INDEX idx_hospitals_type
ON hospitals(hospital_type);

CREATE INDEX idx_hospitals_division
ON hospitals(division);

CREATE INDEX idx_hospitals_district
ON hospitals(district);

CREATE INDEX idx_hospitals_upazila
ON hospitals(upazila);

CREATE INDEX idx_hospitals_verified
ON hospitals(is_verified);

CREATE INDEX idx_hospitals_active
ON hospitals(is_active);

CREATE INDEX idx_hospitals_rating
ON hospitals(average_rating);

CREATE INDEX idx_hospitals_location
ON hospitals(
    division,
    district,
    upazila
);

CREATE INDEX idx_hospitals_search
ON hospitals(
    hospital_type,
    division,
    district,
    average_rating
);

-- ==========================================================
-- End of Part 4
-- ==========================================================
-- ==========================================================
-- CHAMBERS TABLE
-- ==========================================================

CREATE TABLE chambers (

    id BIGSERIAL PRIMARY KEY,

    doctor_id BIGINT NOT NULL,

    hospital_id BIGINT,

    chamber_name VARCHAR(255) NOT NULL,

    room_no VARCHAR(50),

    floor VARCHAR(50),

    building VARCHAR(150),

    address TEXT NOT NULL,

    division VARCHAR(100) NOT NULL,

    district VARCHAR(100) NOT NULL,

    upazila VARCHAR(100),

    postal_code VARCHAR(20),

    phone VARCHAR(20),

    email VARCHAR(150),

    map_url TEXT,

    latitude DECIMAL(10,8),

    longitude DECIMAL(11,8),

    visiting_days VARCHAR(255),

    start_time TIME,

    end_time TIME,

    appointment_duration INTEGER
        DEFAULT 20
        CHECK (appointment_duration > 0),

    max_daily_patients INTEGER
        DEFAULT 30
        CHECK (max_daily_patients > 0),

    consultation_fee NUMERIC(10,2)
        DEFAULT 0.00
        CHECK (consultation_fee >= 0),

    followup_fee NUMERIC(10,2)
        DEFAULT 0.00
        CHECK (followup_fee >= 0),

    followup_valid_days INTEGER
        DEFAULT 7
        CHECK (followup_valid_days >= 0),

    online_payment_available BOOLEAN
        DEFAULT FALSE,

    wheelchair_access BOOLEAN
        DEFAULT FALSE,

    parking_available BOOLEAN
        DEFAULT FALSE,

    air_conditioned BOOLEAN
        DEFAULT FALSE,

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
        ON DELETE SET NULL,

    CONSTRAINT chk_chamber_time
        CHECK (
            start_time IS NULL
            OR end_time IS NULL
            OR start_time < end_time
        )
);

-- ==========================================================
-- CHAMBER INDEXES
-- ==========================================================

CREATE INDEX idx_chambers_doctor
ON chambers(doctor_id);

CREATE INDEX idx_chambers_hospital
ON chambers(hospital_id);

CREATE INDEX idx_chambers_division
ON chambers(division);

CREATE INDEX idx_chambers_district
ON chambers(district);

CREATE INDEX idx_chambers_upazila
ON chambers(upazila);

CREATE INDEX idx_chambers_active
ON chambers(is_active);

CREATE INDEX idx_chambers_fee
ON chambers(consultation_fee);

CREATE INDEX idx_chambers_phone
ON chambers(phone);

CREATE INDEX idx_chambers_location
ON chambers(
    division,
    district,
    upazila
);

CREATE INDEX idx_chambers_doctor_active
ON chambers(
    doctor_id,
    is_active
);

-- ==========================================================
-- End of Part 5
-- ==========================================================
-- ==========================================================
-- SPECIALTIES TABLE
-- ==========================================================

CREATE TABLE specialties (

    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(150) NOT NULL UNIQUE,

    slug VARCHAR(150) NOT NULL UNIQUE,

    description TEXT,

    icon TEXT,

    display_order INTEGER
        DEFAULT 0,

    is_active BOOLEAN
        DEFAULT TRUE,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- SPECIALTY INDEXES
-- ==========================================================

CREATE INDEX idx_specialties_name
ON specialties(name);

CREATE INDEX idx_specialties_slug
ON specialties(slug);

CREATE INDEX idx_specialties_active
ON specialties(is_active);

CREATE INDEX idx_specialties_display
ON specialties(display_order);

-- ==========================================================
-- DOCTOR SPECIALTIES TABLE
-- ==========================================================

CREATE TABLE doctor_specialties (

    id BIGSERIAL PRIMARY KEY,

    doctor_id BIGINT NOT NULL,

    specialty_id BIGINT NOT NULL,

    is_primary BOOLEAN
        DEFAULT FALSE,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ds_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES doctors(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_ds_specialty
        FOREIGN KEY (specialty_id)
        REFERENCES specialties(id)
        ON DELETE CASCADE,

    CONSTRAINT unique_doctor_specialty
        UNIQUE (
            doctor_id,
            specialty_id
        )
);

-- ==========================================================
-- DOCTOR SPECIALTY INDEXES
-- ==========================================================

CREATE INDEX idx_ds_doctor
ON doctor_specialties(doctor_id);

CREATE INDEX idx_ds_specialty
ON doctor_specialties(specialty_id);

CREATE INDEX idx_ds_primary
ON doctor_specialties(is_primary);

-- ==========================================================
-- DEFAULT SPECIALTIES
-- ==========================================================

INSERT INTO specialties
(
    name,
    slug,
    description,
    display_order
)
VALUES

('General Medicine','general-medicine','General Physician',1),
('Cardiology','cardiology','Heart Specialist',2),
('Neurology','neurology','Brain & Nervous System',3),
('Neurosurgery','neurosurgery','Brain Surgery',4),
('Orthopedics','orthopedics','Bone & Joint Specialist',5),
('General Surgery','general-surgery','General Surgeon',6),
('Pediatrics','pediatrics','Child Specialist',7),
('Gynecology','gynecology','Women Health Specialist',8),
('Obstetrics','obstetrics','Pregnancy Specialist',9),
('Dermatology','dermatology','Skin Specialist',10),
('Psychiatry','psychiatry','Mental Health Specialist',11),
('Psychology','psychology','Clinical Psychologist',12),
('ENT','ent','Ear Nose Throat Specialist',13),
('Ophthalmology','ophthalmology','Eye Specialist',14),
('Dentistry','dentistry','Dental Specialist',15),
('Urology','urology','Urinary Specialist',16),
('Nephrology','nephrology','Kidney Specialist',17),
('Gastroenterology','gastroenterology','Digestive System Specialist',18),
('Endocrinology','endocrinology','Diabetes & Hormone Specialist',19),
('Pulmonology','pulmonology','Lung Specialist',20),
('Oncology','oncology','Cancer Specialist',21),
('Hematology','hematology','Blood Specialist',22),
('Rheumatology','rheumatology','Arthritis Specialist',23),
('Anesthesiology','anesthesiology','Anesthesia Specialist',24),
('Radiology','radiology','Medical Imaging',25),
('Pathology','pathology','Laboratory Medicine',26),
('Plastic Surgery','plastic-surgery','Plastic Surgeon',27),
('Physical Medicine','physical-medicine','Rehabilitation Specialist',28),
('Infectious Disease','infectious-disease','Infectious Disease Specialist',29),
('Family Medicine','family-medicine','Family Physician',30);

-- ==========================================================
-- End of Part 6
-- ==========================================================
-- ==========================================================
-- APPOINTMENTS TABLE
-- ==========================================================

CREATE TABLE appointments (

    id BIGSERIAL PRIMARY KEY,

    appointment_number VARCHAR(30) UNIQUE NOT NULL,

    patient_id BIGINT NOT NULL,

    doctor_id BIGINT NOT NULL,

    chamber_id BIGINT NOT NULL,

    appointment_date DATE NOT NULL,

    appointment_time TIME NOT NULL,

    serial_number INTEGER NOT NULL
        CHECK (serial_number > 0),

    visit_type VARCHAR(20)
        NOT NULL
        CHECK (
            visit_type IN (
                'Online',
                'Offline'
            )
        ),

    appointment_for VARCHAR(20)
        DEFAULT 'Self'
        CHECK (
            appointment_for IN (
                'Self',
                'Family'
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

    payment_status VARCHAR(20)
        DEFAULT 'Pending'
        CHECK (
            payment_status IN (
                'Pending',
                'Paid',
                'Refunded',
                'Failed'
            )
        ),

    consultation_fee NUMERIC(10,2)
        DEFAULT 0.00
        CHECK (consultation_fee >= 0),

    patient_problem TEXT,

    symptoms TEXT,

    doctor_notes TEXT,

    diagnosis TEXT,

    prescription_url TEXT,

    cancellation_reason TEXT,

    cancelled_by VARCHAR(20)
        CHECK (
            cancelled_by IN (
                'Patient',
                'Doctor',
                'Admin'
            )
        ),

    booked_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    confirmed_at TIMESTAMP,

    completed_at TIMESTAMP,

    cancelled_at TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

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
        ON DELETE CASCADE,

    CONSTRAINT unique_serial
        UNIQUE (
            doctor_id,
            appointment_date,
            serial_number
        )
);

-- ==========================================================
-- APPOINTMENT INDEXES
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

CREATE INDEX idx_appointments_time
ON appointments(appointment_time);

CREATE INDEX idx_appointments_status
ON appointments(status);

CREATE INDEX idx_appointments_payment
ON appointments(payment_status);

CREATE INDEX idx_appointments_visit
ON appointments(visit_type);

CREATE INDEX idx_appointments_serial
ON appointments(serial_number);

CREATE INDEX idx_appointments_doctor_date
ON appointments(
    doctor_id,
    appointment_date
);

CREATE INDEX idx_appointments_patient_date
ON appointments(
    patient_id,
    appointment_date
);

-- ==========================================================
-- End of Part 7
-- ==========================================================
-- ==========================================================
-- REVIEWS TABLE
-- ==========================================================

CREATE TABLE reviews (

    id BIGSERIAL PRIMARY KEY,

    patient_id BIGINT NOT NULL,

    doctor_id BIGINT NOT NULL,

    appointment_id BIGINT,

    rating INTEGER NOT NULL
        CHECK (rating BETWEEN 1 AND 5),

    review_title VARCHAR(255),

    review_text TEXT,

    doctor_reply TEXT,

    recommended BOOLEAN,

    is_anonymous BOOLEAN
        DEFAULT FALSE,

    is_verified BOOLEAN
        DEFAULT FALSE,

    is_approved BOOLEAN
        DEFAULT TRUE,

    report_count INTEGER
        DEFAULT 0
        CHECK (report_count >= 0),

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

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
        ON DELETE SET NULL,

    CONSTRAINT unique_review_per_appointment
        UNIQUE (appointment_id)
);

-- ==========================================================
-- REVIEW INDEXES
-- ==========================================================

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

CREATE INDEX idx_reviews_approved
ON reviews(is_approved);

CREATE INDEX idx_reviews_created
ON reviews(created_at);

CREATE INDEX idx_reviews_doctor_rating
ON reviews(
    doctor_id,
    rating
);

CREATE INDEX idx_reviews_doctor_created
ON reviews(
    doctor_id,
    created_at
);

-- ==========================================================
-- End of Part 8
-- ==========================================================
-- ==========================================================
-- NOTIFICATIONS TABLE
-- ==========================================================

CREATE TABLE notifications (

    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL,

    title VARCHAR(255) NOT NULL,

    message TEXT NOT NULL,

    notification_type VARCHAR(50)
        NOT NULL
        CHECK (
            notification_type IN (
                'Appointment',
                'Reminder',
                'System',
                'Review',
                'Verification',
                'Promotion',
                'Payment',
                'Prescription'
            )
        ),

    priority VARCHAR(20)
        DEFAULT 'Normal'
        CHECK (
            priority IN (
                'Low',
                'Normal',
                'High',
                'Urgent'
            )
        ),

    send_email BOOLEAN
        DEFAULT FALSE,

    send_sms BOOLEAN
        DEFAULT FALSE,

    send_push BOOLEAN
        DEFAULT TRUE,

    is_sent BOOLEAN
        DEFAULT FALSE,

    is_read BOOLEAN
        DEFAULT FALSE,

    sent_at TIMESTAMP,

    read_at TIMESTAMP,

    expires_at TIMESTAMP,

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
-- NOTIFICATION INDEXES
-- ==========================================================

CREATE INDEX idx_notifications_user
ON notifications(user_id);

CREATE INDEX idx_notifications_type
ON notifications(notification_type);

CREATE INDEX idx_notifications_priority
ON notifications(priority);

CREATE INDEX idx_notifications_read
ON notifications(is_read);

CREATE INDEX idx_notifications_sent
ON notifications(is_sent);

CREATE INDEX idx_notifications_created
ON notifications(created_at);

CREATE INDEX idx_notifications_user_read
ON notifications(
    user_id,
    is_read
);

CREATE INDEX idx_notifications_user_created
ON notifications(
    user_id,
    created_at
);

-- ==========================================================
-- End of Part 9
-- ==========================================================
-- ==========================================================
-- DOCTOR AVAILABILITY TABLE
-- ==========================================================

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

    break_start TIME,

    break_end TIME,

    slot_duration_minutes INTEGER
        DEFAULT 20
        CHECK (slot_duration_minutes > 0),

    max_patients INTEGER
        DEFAULT 30
        CHECK (max_patients > 0),

    consultation_mode VARCHAR(20)
        DEFAULT 'Both'
        CHECK (
            consultation_mode IN (
                'Online',
                'Offline',
                'Both'
            )
        ),

    is_available BOOLEAN
        DEFAULT TRUE,

    notes TEXT,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_availability_doctor
        FOREIGN KEY (doctor_id)
        REFERENCES doctors(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_availability_chamber
        FOREIGN KEY (chamber_id)
        REFERENCES chambers(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_availability_time
        CHECK (start_time < end_time),

    CONSTRAINT chk_break_time
        CHECK (
            break_start IS NULL
            OR break_end IS NULL
            OR break_start < break_end
        )
);

-- ==========================================================
-- DOCTOR AVAILABILITY INDEXES
-- ==========================================================

CREATE INDEX idx_availability_doctor
ON doctor_availability(doctor_id);

CREATE INDEX idx_availability_chamber
ON doctor_availability(chamber_id);

CREATE INDEX idx_availability_day
ON doctor_availability(day_of_week);

CREATE INDEX idx_availability_available
ON doctor_availability(is_available);

CREATE INDEX idx_availability_mode
ON doctor_availability(consultation_mode);

CREATE INDEX idx_availability_doctor_day
ON doctor_availability(
    doctor_id,
    day_of_week
);

CREATE INDEX idx_availability_chamber_day
ON doctor_availability(
    chamber_id,
    day_of_week
);

-- ==========================================================
-- End of Part 10
-- ==========================================================
-- ==========================================================
-- APPOINTMENT SLOTS TABLE
-- ==========================================================

CREATE TABLE appointment_slots (

    id BIGSERIAL PRIMARY KEY,

    availability_id BIGINT NOT NULL,

    slot_date DATE NOT NULL,

    start_time TIME NOT NULL,

    end_time TIME NOT NULL,

    slot_status VARCHAR(20)
        DEFAULT 'Available'
        CHECK (
            slot_status IN (
                'Available',
                'Booked',
                'Blocked',
                'Completed',
                'Cancelled'
            )
        ),

    is_booked BOOLEAN
        DEFAULT FALSE,

    appointment_id BIGINT,

    booked_at TIMESTAMP,

    blocked_reason TEXT,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_slot_availability
        FOREIGN KEY (availability_id)
        REFERENCES doctor_availability(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_slot_appointment
        FOREIGN KEY (appointment_id)
        REFERENCES appointments(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_slot_time
        CHECK (start_time < end_time),

    CONSTRAINT unique_slot
        UNIQUE (
            availability_id,
            slot_date,
            start_time
        )
);

-- ==========================================================
-- APPOINTMENT SLOT INDEXES
-- ==========================================================

CREATE INDEX idx_slots_availability
ON appointment_slots(availability_id);

CREATE INDEX idx_slots_date
ON appointment_slots(slot_date);

CREATE INDEX idx_slots_status
ON appointment_slots(slot_status);

CREATE INDEX idx_slots_booked
ON appointment_slots(is_booked);

CREATE INDEX idx_slots_appointment
ON appointment_slots(appointment_id);

CREATE INDEX idx_slots_date_time
ON appointment_slots(
    slot_date,
    start_time
);

CREATE INDEX idx_slots_availability_date
ON appointment_slots(
    availability_id,
    slot_date
);

CREATE INDEX idx_slots_status_date
ON appointment_slots(
    slot_status,
    slot_date
);

-- ==========================================================
-- End of Part 11
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
-- SPECIALTIES TRIGGER
-- ==========================================================

CREATE TRIGGER trg_specialties_updated_at
BEFORE UPDATE ON specialties
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
-- DOCTOR AVAILABILITY TRIGGER
-- ==========================================================

CREATE TRIGGER trg_doctor_availability_updated_at
BEFORE UPDATE ON doctor_availability
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ==========================================================
-- APPOINTMENT SLOTS TRIGGER
-- ==========================================================

CREATE TRIGGER trg_appointment_slots_updated_at
BEFORE UPDATE ON appointment_slots
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ==========================================================
-- DOCTOR SPECIALTIES TABLE
-- (No updated_at column, so no trigger required)
-- ==========================================================

-- ==========================================================
-- DATABASE SCHEMA VERSION
-- ==========================================================

COMMENT ON DATABASE current_database()
IS 'Go Dr Database Schema v2.1 (Production Ready)';

-- ==========================================================
-- END OF SCHEMA
-- Version : 2.1
-- Database: PostgreSQL
-- Status  : Production Ready
-- ==========================================================
