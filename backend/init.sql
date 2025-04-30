CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR UNIQUE NOT NULL,
    password VARCHAR NOT NULL,
    credits INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE import_jobs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    source VARCHAR(20) DEFAULT 'salesnav',
    status VARCHAR(20) DEFAULT 'processing',
    total INTEGER,
    completed INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE contacts (
    id SERIAL PRIMARY KEY,
    job_id UUID REFERENCES import_jobs(id) ON DELETE CASCADE,
    first_name VARCHAR,
    last_name VARCHAR,
    company VARCHAR,
    linkedin_url TEXT,
    email VARCHAR,
    phone VARCHAR,
    enriched BOOLEAN DEFAULT false
);
