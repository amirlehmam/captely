-- Create CRM tables for contacts, activities, and campaigns

-- CRM Contacts table
CREATE TABLE IF NOT EXISTS crm_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(255),
    company VARCHAR(255),
    position VARCHAR(255),
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'customer', 'lost')),
    lead_score INTEGER DEFAULT 0,
    tags TEXT,
    last_contacted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- CRM Activities table
CREATE TABLE IF NOT EXISTS crm_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'task', 'note', 'follow_up')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'overdue')),
    priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255) NOT NULL,
    assigned_to VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- CRM Campaigns table
CREATE TABLE IF NOT EXISTS crm_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'email',
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
    from_email VARCHAR(255),
    from_name VARCHAR(255),
    total_contacts INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON crm_contacts(email);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_company ON crm_contacts(company);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_status ON crm_contacts(status);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_created_at ON crm_contacts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_activities_contact_id ON crm_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_type ON crm_activities(type);
CREATE INDEX IF NOT EXISTS idx_crm_activities_status ON crm_activities(status);
CREATE INDEX IF NOT EXISTS idx_crm_activities_due_date ON crm_activities(due_date);
CREATE INDEX IF NOT EXISTS idx_crm_activities_created_at ON crm_activities(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_campaigns_status ON crm_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_crm_campaigns_type ON crm_campaigns(type);
CREATE INDEX IF NOT EXISTS idx_crm_campaigns_created_at ON crm_campaigns(created_at DESC);

-- Insert some sample data
INSERT INTO crm_contacts (first_name, last_name, email, phone, company, position, status, lead_score) VALUES
    ('John', 'Smith', 'john@techcorp.com', '+1-555-0101', 'TechCorp Inc.', 'CEO', 'qualified', 85),
    ('Sarah', 'Johnson', 'sarah@marketingco.com', '+1-555-0102', 'Marketing Co.', 'VP Marketing', 'contacted', 70),
    ('Mike', 'Chen', 'mike@techstart.io', '+1-555-0103', 'TechStart', 'CTO', 'new', 60),
    ('Lisa', 'Wong', 'lisa@datacorp.com', '+1-555-0104', 'DataCorp', 'Data Scientist', 'customer', 95),
    ('David', 'Brown', 'david@salesforce.example', '+1-555-0105', 'SalesForce Pro', 'Sales Director', 'new', 45)
ON CONFLICT DO NOTHING;

-- Insert sample activities
INSERT INTO crm_activities (type, title, description, contact_id, status, priority, due_date, created_by, assigned_to) VALUES
    ('call', 'Follow-up call with John Smith', 'Discuss pricing and next steps for enterprise plan', (SELECT id FROM crm_contacts WHERE email = 'john@techcorp.com'), 'pending', 'high', CURRENT_TIMESTAMP + INTERVAL '1 day', 'user1', 'user1'),
    ('email', 'Send proposal to Sarah Johnson', 'Include custom integration details and timeline', (SELECT id FROM crm_contacts WHERE email = 'sarah@marketingco.com'), 'completed', 'medium', CURRENT_TIMESTAMP - INTERVAL '1 day', 'user1', 'user2'),
    ('meeting', 'Product demo with TechStart team', 'Showcase new features and answer technical questions', (SELECT id FROM crm_contacts WHERE email = 'mike@techstart.io'), 'pending', 'high', CURRENT_TIMESTAMP + INTERVAL '3 days', 'user1', 'user1'),
    ('task', 'Prepare contract for Enterprise deal', 'Include custom terms discussed in last meeting', NULL, 'overdue', 'urgent', CURRENT_TIMESTAMP - INTERVAL '1 day', 'user1', 'user1'),
    ('follow_up', 'Check in with trial users', 'Send feedback survey and offer support', NULL, 'pending', 'low', CURRENT_TIMESTAMP + INTERVAL '7 days', 'user1', 'user2'),
    ('note', 'Client feedback on latest features', 'Positive response to new dashboard, requested mobile app', (SELECT id FROM crm_contacts WHERE email = 'lisa@datacorp.com'), 'completed', 'medium', NULL, 'user2')
ON CONFLICT DO NOTHING;

-- Insert sample campaigns
INSERT INTO crm_campaigns (name, type, status, from_email, from_name, total_contacts, sent_count, open_count, click_count, reply_count) VALUES
    ('Q2 Product Launch Campaign', 'email', 'active', 'marketing@captely.com', 'Captely Marketing', 1500, 1200, 420, 85, 24),
    ('Enterprise Outreach', 'email', 'active', 'sales@captely.com', 'Captely Sales', 300, 280, 145, 32, 8),
    ('Customer Feedback Survey', 'email', 'completed', 'success@captely.com', 'Captely Success', 850, 850, 380, 127, 89),
    ('New Feature Announcement', 'email', 'draft', 'product@captely.com', 'Captely Product', 0, 0, 0, 0, 0)
ON CONFLICT DO NOTHING; 