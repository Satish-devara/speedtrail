-- Core Table: Users
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Core Table: Groups
CREATE TABLE groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Core Table: Group Memberships with strict join/leave dates to handle timeline anomalies
CREATE TABLE group_memberships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TIMESTAMP NOT NULL,
    left_at TIMESTAMP, -- NULL means currently active in group
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_timeline CHECK (left_at IS NULL OR left_at >= joined_at),
    UNIQUE(group_id, user_id, joined_at)
);

-- Core Table: Expenses supporting INR and USD
CREATE TABLE expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    paid_by_user_id INTEGER NOT NULL,
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 4) NOT NULL, -- original amount spent
    currency VARCHAR(3) NOT NULL DEFAULT 'INR', -- 'INR' or 'USD'
    exchange_rate_to_inr DECIMAL(15, 6) NOT NULL DEFAULT 1.000000, -- 1.0 for INR, e.g., 83.00 for USD
    amount_inr DECIMAL(15, 4) NOT NULL, -- precalculated amount in INR for quick debt calculations
    expense_date TIMESTAMP NOT NULL,
    split_type VARCHAR(20) NOT NULL, -- 'EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES'
    status VARCHAR(20) NOT NULL DEFAULT 'FINALIZED', -- 'PENDING_REVIEW', 'FINALIZED'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (paid_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_split_type CHECK (split_type IN ('EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES')),
    CONSTRAINT chk_expense_status CHECK (status IN ('PENDING_REVIEW', 'FINALIZED'))
);

-- Core Table: Expense Splits for mapping individual contributions
CREATE TABLE expense_splits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    split_value DECIMAL(15, 4) NOT NULL, -- exact amount, percentage share, or shares count
    calculated_amount_inr DECIMAL(15, 4) NOT NULL, -- actual share in INR
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Core Table: Settlements and Debt Payments
CREATE TABLE settlements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    from_user_id INTEGER NOT NULL,
    to_user_id INTEGER NOT NULL,
    amount DECIMAL(15, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    exchange_rate_to_inr DECIMAL(15, 6) NOT NULL DEFAULT 1.000000,
    amount_inr DECIMAL(15, 4) NOT NULL,
    settled_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Staging Table: Import Anomalies
CREATE TABLE import_anomalies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_row_index INTEGER NOT NULL,
    raw_data TEXT NOT NULL, -- JSON string of the CSV row
    error_type VARCHAR(100) NOT NULL, -- e.g., 'TIMELINE_VIOLATION', 'CURRENCY_MISMATCH', 'DUPLICATE'
    error_description TEXT NOT NULL,
    proposed_fix TEXT, -- JSON string of the recommended DB fields
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING_REVIEW', -- 'PENDING_REVIEW', 'APPROVED', 'IGNORED', 'RESOLVED'
    resolved_at TIMESTAMP,
    resolved_by_user_id INTEGER,
    FOREIGN KEY (resolved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
