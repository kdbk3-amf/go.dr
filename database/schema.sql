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
