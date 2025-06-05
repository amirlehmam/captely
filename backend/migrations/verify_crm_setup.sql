-- Verify CRM Setup and Fix Sample Data
-- Run this to check everything is working and add proper sample activities

-- 1. Check what CRM contacts actually exist
SELECT 'Existing CRM Contacts:' as info;
SELECT id, first_name, last_name, email, company FROM crm_contacts LIMIT 10;

-- 2. Check campaigns
SELECT 'Existing CRM Campaigns:' as info;
SELECT id, name, type, status FROM crm_campaigns LIMIT 5;

-- 3. Insert working sample activities using actual contact IDs
INSERT INTO crm_activities (id, type, title, description, contact_id, status, priority, due_date, created_by, assigned_to) 
SELECT 
    uuid_generate_v4(),
    'call',
    'Follow-up call with ' || first_name || ' ' || last_name,
    'Discuss their business needs and our solutions',
    id,
    'pending',
    'medium',
    NOW() + INTERVAL '3 days',
    'system',
    'sales_team'
FROM crm_contacts 
WHERE email IS NOT NULL 
LIMIT 3;

-- 4. Insert some activities without contact references
INSERT INTO crm_activities (id, type, title, description, status, priority, due_date, created_by, assigned_to) VALUES
    (uuid_generate_v4(), 'task', 'Review quarterly sales reports', 'Analyze Q4 performance and prepare for Q1 planning', 'pending', 'high', NOW() + INTERVAL '1 day', 'system', 'sales_team'),
    (uuid_generate_v4(), 'meeting', 'Team standup meeting', 'Daily team sync and progress updates', 'completed', 'low', NOW() - INTERVAL '1 day', 'system', 'sales_team'),
    (uuid_generate_v4(), 'email', 'Send welcome email to new leads', 'Template-based welcome sequence for new sign-ups', 'pending', 'medium', NOW() + INTERVAL '2 days', 'system', 'marketing_team');

-- 5. Verify everything is working
SELECT 'Final verification:' as info;
SELECT 'Total CRM contacts: ' || COUNT(*) as result FROM crm_contacts;
SELECT 'Total CRM activities: ' || COUNT(*) as result FROM crm_activities;  
SELECT 'Total CRM campaigns: ' || COUNT(*) as result FROM crm_campaigns;

-- 6. Show sample activities with contact info
SELECT 'Sample activities with contacts:' as info;
SELECT 
    a.type,
    a.title,
    a.status,
    a.priority,
    COALESCE(c.first_name || ' ' || c.last_name, 'No contact') as contact_name
FROM crm_activities a
LEFT JOIN crm_contacts c ON a.contact_id = c.id
ORDER BY a.created_at DESC
LIMIT 5; 