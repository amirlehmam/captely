-- Final CRM Enum Fix - Using exact names the CRM service expects
-- Based on error analysis: service expects 'priority' not 'activitypriority'

-- 1. Drop existing types safely
DO $$
BEGIN
    DROP TYPE IF EXISTS activitytype CASCADE;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
    DROP TYPE IF EXISTS activitystatus CASCADE;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
    DROP TYPE IF EXISTS priority CASCADE;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
    DROP TYPE IF EXISTS activitypriority CASCADE;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
    DROP TYPE IF EXISTS campaignstatus CASCADE;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
    DROP TYPE IF EXISTS contactstatus CASCADE;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- 2. Create enum types with exact names the CRM service expects
CREATE TYPE activitytype AS ENUM ('call', 'email', 'meeting', 'task', 'note', 'follow_up');
CREATE TYPE activitystatus AS ENUM ('pending', 'completed', 'cancelled', 'overdue');
CREATE TYPE priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE campaignstatus AS ENUM ('draft', 'active', 'paused', 'completed');
CREATE TYPE contactstatus AS ENUM ('new', 'contacted', 'qualified', 'customer', 'lost');

-- 3. Drop and recreate CRM tables with correct enum types
DROP TABLE IF EXISTS crm_activities CASCADE;
DROP TABLE IF EXISTS crm_campaigns CASCADE;

-- 4. Create CRM Activities table with correct enum type names
CREATE TABLE crm_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type activitytype NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
    status activitystatus DEFAULT 'pending',
    priority priority DEFAULT 'medium',
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255) NOT NULL,
    assigned_to VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Create CRM Campaigns table
CREATE TABLE crm_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'email',
    status campaignstatus DEFAULT 'draft',
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

-- 6. Update crm_contacts table (skip if it fails)
DO $$
BEGIN
    ALTER TABLE crm_contacts ALTER COLUMN status TYPE contactstatus USING status::contactstatus;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not convert crm_contacts.status to enum, keeping as VARCHAR';
END $$;

-- 7. Create indexes
CREATE INDEX idx_crm_activities_contact_id ON crm_activities(contact_id);
CREATE INDEX idx_crm_activities_type ON crm_activities(type);
CREATE INDEX idx_crm_activities_status ON crm_activities(status);
CREATE INDEX idx_crm_activities_priority ON crm_activities(priority);
CREATE INDEX idx_crm_activities_due_date ON crm_activities(due_date);
CREATE INDEX idx_crm_activities_created_at ON crm_activities(created_at DESC);

CREATE INDEX idx_crm_campaigns_status ON crm_campaigns(status);
CREATE INDEX idx_crm_campaigns_type ON crm_campaigns(type);
CREATE INDEX idx_crm_campaigns_created_at ON crm_campaigns(created_at DESC);

-- 8. Insert sample data
INSERT INTO crm_campaigns (id, name, type, status, from_email, from_name, total_contacts, sent_count, open_count, click_count, reply_count) VALUES
    ('00000000-0000-0000-0006-000000000001', 'Q2 Product Launch Campaign', 'email', 'active', 'marketing@captely.com', 'Captely Marketing', 1500, 1200, 420, 85, 24),
    ('00000000-0000-0000-0006-000000000002', 'Enterprise Outreach', 'email', 'active', 'sales@captely.com', 'Captely Sales', 300, 280, 145, 32, 8),
    ('00000000-0000-0000-0006-000000000003', 'Customer Feedback Survey', 'email', 'completed', 'success@captely.com', 'Captely Success', 850, 850, 380, 127, 89),
    ('00000000-0000-0000-0006-000000000004', 'New Feature Announcement', 'email', 'draft', 'product@captely.com', 'Captely Product', 0, 0, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO crm_activities (id, type, title, description, status, priority, due_date, created_by, assigned_to) VALUES
    (uuid_generate_v4(), 'task', 'Review quarterly sales reports', 'Analyze Q4 performance and prepare for Q1 planning', 'pending', 'high', NOW() + INTERVAL '1 day', 'system', 'sales_team'),
    (uuid_generate_v4(), 'meeting', 'Team standup meeting', 'Daily team sync and progress updates', 'completed', 'low', NOW() - INTERVAL '1 day', 'system', 'sales_team'),
    (uuid_generate_v4(), 'email', 'Send welcome email to new leads', 'Template-based welcome sequence for new sign-ups', 'pending', 'medium', NOW() + INTERVAL '2 days', 'system', 'marketing_team'),
    (uuid_generate_v4(), 'call', 'Follow-up call with prospects', 'Discuss their business needs and our solutions', 'pending', 'medium', NOW() + INTERVAL '3 days', 'system', 'sales_team'),
    (uuid_generate_v4(), 'follow_up', 'Check in with trial users', 'Send feedback survey and offer support', 'pending', 'low', NOW() + INTERVAL '7 days', 'system', 'marketing_team'),
    (uuid_generate_v4(), 'note', 'Client feedback on latest features', 'Positive response to new dashboard, requested mobile app', 'completed', 'medium', NULL, 'system', 'product_team')
ON CONFLICT (id) DO NOTHING;

-- 9. Verify everything is working
SELECT 'CRM tables fixed with correct enum type names' as status;
SELECT 'Total activities: ' || COUNT(*) as result FROM crm_activities;
SELECT 'Total campaigns: ' || COUNT(*) as result FROM crm_campaigns;
SELECT 'Total contacts: ' || COUNT(*) as result FROM crm_contacts;

-- 10. Test enum types are working
SELECT 'Testing enum types:' as info;
SELECT 'activitytype values: ' || string_agg(enumlabel, ', ') as types FROM pg_enum WHERE enumtypid = 'activitytype'::regtype;
SELECT 'priority values: ' || string_agg(enumlabel, ', ') as priorities FROM pg_enum WHERE enumtypid = 'priority'::regtype;
SELECT 'activitystatus values: ' || string_agg(enumlabel, ', ') as statuses FROM pg_enum WHERE enumtypid = 'activitystatus'::regtype; 