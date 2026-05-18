-- Run this FULL file in MySQL Workbench
-- It recreates database and tables properly

DROP DATABASE IF EXISTS expense_tracker;

CREATE DATABASE expense_tracker
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE expense_tracker;

-- USERS TABLE
CREATE TABLE users
(
    id INT NOT NULL AUTO_INCREMENT,

    name VARCHAR(100) NOT NULL,

    email VARCHAR(255) NOT NULL UNIQUE,

    password VARCHAR(255) NOT NULL,

    created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY(id),

    INDEX idx_email(email)
);




-- EXPENSES TABLE
CREATE TABLE expenses
(
    id INT NOT NULL AUTO_INCREMENT,

    user_id INT NOT NULL,

    name VARCHAR(255) NOT NULL,

    amount DECIMAL(12,2) NOT NULL,

    category ENUM
    (
        'Food',
        'Transport',
        'Shopping',
        'Entertainment',
        'Health',
        'Utilities',
        'Other'
    )
    NOT NULL DEFAULT 'Other',

    date DATE NOT NULL,

    created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY(id),

    CONSTRAINT fk_user_expense
    FOREIGN KEY(user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

    INDEX idx_user_id(user_id),

    INDEX idx_category(category),

    INDEX idx_date(date)
);