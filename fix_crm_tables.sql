-- Fix CRM Tables - Run this manually on your existing database
-- This adds the missing CRM tables to your current database

-- CRM Activities table
CREATE TABLE IF NOT EXISTS crm_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- CRM Campaigns table
CREATE TABLE IF NOT EXISTS crm_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_crm_activities_contact_id ON crm_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_type ON crm_activities(type);
CREATE INDEX IF NOT EXISTS idx_crm_activities_status ON crm_activities(status);
CREATE INDEX IF NOT EXISTS idx_crm_activities_due_date ON crm_activities(due_date);
CREATE INDEX IF NOT EXISTS idx_crm_activities_created_at ON crm_activities(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_campaigns_status ON crm_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_crm_campaigns_type ON crm_campaigns(type);
CREATE INDEX IF NOT EXISTS idx_crm_campaigns_created_at ON crm_campaigns(created_at DESC);

-- Insert sample CRM activities
INSERT INTO crm_activities (id, type, title, description, contact_id, status, priority, due_date, created_by, assigned_to) VALUES
    ('00000000-0000-0000-0005-000000000001', 'call', 'Follow-up call with John Smith', 'Discuss pricing and next steps for enterprise plan', '00000000-0000-0000-0004-000000000001', 'pending', 'high', NOW() + INTERVAL '1 day', 'test_user', 'test_user'),
    ('00000000-0000-0000-0005-000000000002', 'email', 'Send proposal to Sarah Johnson', 'Include custom integration details and timeline', '00000000-0000-0000-0004-000000000002', 'completed', 'medium', NOW() - INTERVAL '1 day', 'test_user', 'test_user'),
    ('00000000-0000-0000-0005-000000000003', 'meeting', 'Product demo with TechStart team', 'Showcase new features and answer technical questions', '00000000-0000-0000-0004-000000000003', 'pending', 'high', NOW() + INTERVAL '3 days', 'test_user', 'test_user'),
    ('00000000-0000-0000-0005-000000000004', 'task', 'Prepare contract for Enterprise deal', 'Include custom terms discussed in last meeting', NULL, 'overdue', 'urgent', NOW() - INTERVAL '1 day', 'test_user', 'test_user'),
    ('00000000-0000-0000-0005-000000000005', 'follow_up', 'Check in with trial users', 'Send feedback survey and offer support', NULL, 'pending', 'low', NOW() + INTERVAL '7 days', 'test_user', 'test_user'),
    ('00000000-0000-0000-0005-000000000006', 'note', 'Client feedback on latest features', 'Positive response to new dashboard, requested mobile app', '00000000-0000-0000-0004-000000000004', 'completed', 'medium', NULL, 'test_user', 'test_user')
ON CONFLICT (id) DO NOTHING;

-- Insert sample CRM campaigns
INSERT INTO crm_campaigns (id, name, type, status, from_email, from_name, total_contacts, sent_count, open_count, click_count, reply_count) VALUES
    ('00000000-0000-0000-0006-000000000001', 'Q2 Product Launch Campaign', 'email', 'active', 'marketing@captely.com', 'Captely Marketing', 1500, 1200, 420, 85, 24),
    ('00000000-0000-0000-0006-000000000002', 'Enterprise Outreach', 'email', 'active', 'sales@captely.com', 'Captely Sales', 300, 280, 145, 32, 8),
    ('00000000-0000-0000-0006-000000000003', 'Customer Feedback Survey', 'email', 'completed', 'success@captely.com', 'Captely Success', 850, 850, 380, 127, 89),
    ('00000000-0000-0000-0006-000000000004', 'New Feature Announcement', 'email', 'draft', 'product@captely.com', 'Captely Product', 0, 0, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- Check if CRM contacts exist, if not create some sample data
INSERT INTO crm_contacts (id, user_id, first_name, last_name, email, phone, company, position, status, lead_score) VALUES
    ('00000000-0000-0000-0004-000000000001', (SELECT id FROM users WHERE email = 'test@captely.com'), 'John', 'Smith', 'john@techcorp.com', '+1-555-0101', 'TechCorp Inc.', 'CEO', 'qualified', 85),
    ('00000000-0000-0000-0004-000000000002', (SELECT id FROM users WHERE email = 'test@captely.com'), 'Sarah', 'Johnson', 'sarah@marketingco.com', '+1-555-0102', 'Marketing Co.', 'VP Marketing', 'contacted', 70),
    ('00000000-0000-0000-0004-000000000003', (SELECT id FROM users WHERE email = 'test@captely.com'), 'Mike', 'Chen', 'mike@techstart.io', '+1-555-0103', 'TechStart', 'CTO', 'new', 60),
    ('00000000-0000-0000-0004-000000000004', (SELECT id FROM users WHERE email = 'test@captely.com'), 'Lisa', 'Wong', 'lisa@datacorp.com', '+1-555-0104', 'DataCorp', 'Data Scientist', 'customer', 95),
    ('00000000-0000-0000-0004-000000000005', (SELECT id FROM users WHERE email = 'test@captely.com'), 'David', 'Brown', 'david@salesforce.example', '+1-555-0105', 'SalesForce Pro', 'Sales Director', 'new', 45)
ON CONFLICT (user_id, email) DO NOTHING;

-- Verify tables were created
SELECT 'crm_activities table created' as result WHERE EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'crm_activities');
SELECT 'crm_campaigns table created' as result WHERE EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'crm_campaigns');
SELECT 'crm_contacts table exists' as result WHERE EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'crm_contacts');

-- Show sample data counts
SELECT 'Sample activities: ' || COUNT(*) as result FROM crm_activities;
SELECT 'Sample campaigns: ' || COUNT(*) as result FROM crm_campaigns;
SELECT 'Sample CRM contacts: ' || COUNT(*) as result FROM crm_contacts; 