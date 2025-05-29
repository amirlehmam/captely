-- Create billing_transactions table
CREATE TABLE IF NOT EXISTS billing_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
    payment_method_id VARCHAR(255),
    type VARCHAR(50) NOT NULL CHECK (type IN ('payment', 'refund', 'credit_purchase', 'subscription')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'canceled')),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    description TEXT,
    provider_transaction_id VARCHAR(255),
    transaction_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_billing_transactions_user_id ON billing_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_created_at ON billing_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_status ON billing_transactions(status);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_type ON billing_transactions(type);

-- Add some sample billing transactions for the test user
INSERT INTO billing_transactions (user_id, type, status, amount, currency, description, provider_transaction_id) 
VALUES 
    ('00000000-0000-0000-0002-000000000001', 'subscription', 'succeeded', 29.99, 'USD', 'Professional Plan - Monthly', 'stripe_pi_example123'),
    ('00000000-0000-0000-0002-000000000001', 'credit_purchase', 'succeeded', 49.99, 'USD', '5,000 Additional Credits', 'stripe_pi_example124'),
    ('00000000-0000-0000-0002-000000000001', 'subscription', 'succeeded', 29.99, 'USD', 'Professional Plan - Monthly', 'stripe_pi_example125')
ON CONFLICT DO NOTHING;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_billing_transactions_updated_at()
    RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_billing_transactions_updated_at_trigger
    BEFORE UPDATE ON billing_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_billing_transactions_updated_at(); 