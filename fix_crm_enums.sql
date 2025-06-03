-- Fix CRM Enum Types
-- The CRM service expects PostgreSQL enum types that don't exist yet

-- 1. Create the missing enum types
CREATE TYPE IF NOT EXISTS activitytype AS ENUM ('call', 'email', 'meeting', 'task', 'note', 'follow_up');
CREATE TYPE IF NOT EXISTS activitystatus AS ENUM ('pending', 'completed', 'cancelled', 'overdue');
CREATE TYPE IF NOT EXISTS activitypriority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE IF NOT EXISTS campaignstatus AS ENUM ('draft', 'active', 'paused', 'completed');
CREATE TYPE IF NOT EXISTS contactstatus AS ENUM ('new', 'contacted', 'qualified', 'customer', 'lost');

-- 2. Drop existing CRM tables (they have wrong column types)
DROP TABLE IF EXISTS crm_activities CASCADE;
DROP TABLE IF EXISTS crm_campaigns CASCADE;

-- 3. Recreate CRM Activities table with proper enum types
CREATE TABLE crm_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type activitytype NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
    status activitystatus DEFAULT 'pending',
    priority activitypriority DEFAULT 'medium',
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255) NOT NULL,
    assigned_to VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Recreate CRM Campaigns table with proper enum types
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

-- 5. Update crm_contacts table to use proper enum type
ALTER TABLE crm_contacts ALTER COLUMN status TYPE contactstatus USING status::contactstatus;

-- 6. Create indexes
CREATE INDEX IF NOT EXISTS idx_crm_activities_contact_id ON crm_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_type ON crm_activities(type);
CREATE INDEX IF NOT EXISTS idx_crm_activities_status ON crm_activities(status);
CREATE INDEX IF NOT EXISTS idx_crm_activities_due_date ON crm_activities(due_date);
CREATE INDEX IF NOT EXISTS idx_crm_activities_created_at ON crm_activities(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_campaigns_status ON crm_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_crm_campaigns_type ON crm_campaigns(type);
CREATE INDEX IF NOT EXISTS idx_crm_campaigns_created_at ON crm_campaigns(created_at DESC);

-- 7. Insert sample data with proper enum values
INSERT INTO crm_campaigns (id, name, type, status, from_email, from_name, total_contacts, sent_count, open_count, click_count, reply_count) VALUES
    ('00000000-0000-0000-0006-000000000001', 'Q2 Product Launch Campaign', 'email', 'active', 'marketing@captely.com', 'Captely Marketing', 1500, 1200, 420, 85, 24),
    ('00000000-0000-0000-0006-000000000002', 'Enterprise Outreach', 'email', 'active', 'sales@captely.com', 'Captely Sales', 300, 280, 145, 32, 8),
    ('00000000-0000-0000-0006-000000000003', 'Customer Feedback Survey', 'email', 'completed', 'success@captely.com', 'Captely Success', 850, 850, 380, 127, 89),
    ('00000000-0000-0000-0006-000000000004', 'New Feature Announcement', 'email', 'draft', 'product@captely.com', 'Captely Product', 0, 0, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- 8. Insert sample activities with proper enum values
INSERT INTO crm_activities (id, type, title, description, status, priority, due_date, created_by, assigned_to) VALUES
    (uuid_generate_v4(), 'task', 'Review quarterly sales reports', 'Analyze Q4 performance and prepare for Q1 planning', 'pending', 'high', NOW() + INTERVAL '1 day', 'system', 'sales_team'),
    (uuid_generate_v4(), 'meeting', 'Team standup meeting', 'Daily team sync and progress updates', 'completed', 'low', NOW() - INTERVAL '1 day', 'system', 'sales_team'),
    (uuid_generate_v4(), 'email', 'Send welcome email to new leads', 'Template-based welcome sequence for new sign-ups', 'pending', 'medium', NOW() + INTERVAL '2 days', 'system', 'marketing_team'),
    (uuid_generate_v4(), 'call', 'Follow-up call with prospects', 'Discuss their business needs and our solutions', 'pending', 'medium', NOW() + INTERVAL '3 days', 'system', 'sales_team'),
    (uuid_generate_v4(), 'follow_up', 'Check in with trial users', 'Send feedback survey and offer support', 'pending', 'low', NOW() + INTERVAL '7 days', 'system', 'marketing_team'),
    (uuid_generate_v4(), 'note', 'Client feedback on latest features', 'Positive response to new dashboard, requested mobile app', 'completed', 'medium', NULL, 'system', 'product_team')
ON CONFLICT (id) DO NOTHING;

-- 9. Verify everything is working
SELECT 'Fixed CRM tables with proper enum types' as status;
SELECT 'Total activities: ' || COUNT(*) as result FROM crm_activities;
SELECT 'Total campaigns: ' || COUNT(*) as result FROM crm_campaigns;
SELECT 'Total contacts: ' || COUNT(*) as result FROM crm_contacts; 