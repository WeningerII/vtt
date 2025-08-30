-- User Management Database Schema
-- This file contains the complete database schema for user accounts, billing, and notifications

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(30) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin', 'super_admin')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned', 'inactive')),
    timezone VARCHAR(50),
    avatar_url TEXT,
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User sessions table
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    refresh_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Login attempts table (for rate limiting and security)
CREATE TABLE login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identifier VARCHAR(255) NOT NULL, -- username or email
    ip_address INET NOT NULL,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    failure_reason VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Password reset requests table
CREATE TABLE password_reset_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email verification tokens table
CREATE TABLE email_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription plans table
CREATE TABLE subscription_plans (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    tier VARCHAR(20) NOT NULL CHECK (tier IN ('free', 'basic', 'premium', 'enterprise')),
    price DECIMAL(10, 2) NOT NULL,
    currency CHAR(3) DEFAULT 'USD',
    interval VARCHAR(10) NOT NULL CHECK (interval IN ('month', 'year')),
    features JSONB NOT NULL,
    limits JSONB NOT NULL,
    stripe_product_id VARCHAR(100),
    stripe_price_id VARCHAR(100),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User subscriptions table
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id VARCHAR(50) NOT NULL REFERENCES subscription_plans(id),
    stripe_subscription_id VARCHAR(100) UNIQUE,
    stripe_customer_id VARCHAR(100),
    status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid', 'incomplete')),
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    trial_start TIMESTAMP WITH TIME ZONE,
    trial_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment methods table
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_payment_method_id VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('card', 'bank_account', 'paypal')),
    card_last4 CHAR(4),
    card_brand VARCHAR(20),
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    billing_address JSONB,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices table
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    stripe_invoice_id VARCHAR(100) UNIQUE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency CHAR(3) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    hosted_invoice_url TEXT,
    invoice_pdf TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage records table
CREATE TABLE usage_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL, -- e.g., 'campaigns', 'storage', 'assets', 'api_calls'
    quantity INTEGER NOT NULL DEFAULT 1,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB
);

-- Notification templates table
CREATE TABLE notification_templates (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('email', 'push', 'in_app')),
    category VARCHAR(20) NOT NULL CHECK (category IN ('account', 'game', 'billing', 'system', 'marketing')),
    subject VARCHAR(255),
    html_template TEXT,
    text_template TEXT,
    push_template TEXT,
    variables TEXT[],
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email notifications table
CREATE TABLE email_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_id VARCHAR(50) REFERENCES notification_templates(id),
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    html_content TEXT,
    text_content TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'bounced', 'failed')),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Push notifications table
CREATE TABLE push_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_id VARCHAR(50) REFERENCES notification_templates(id),
    title VARCHAR(100) NOT NULL,
    body TEXT NOT NULL,
    icon TEXT,
    badge TEXT,
    data JSONB,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- In-app notifications table
CREATE TABLE in_app_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error')),
    title VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    action_url TEXT,
    action_text VARCHAR(50),
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification preferences table
CREATE TABLE notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email_enabled BOOLEAN DEFAULT TRUE,
    email_account BOOLEAN DEFAULT TRUE,
    email_game BOOLEAN DEFAULT TRUE,
    email_billing BOOLEAN DEFAULT TRUE,
    email_system BOOLEAN DEFAULT TRUE,
    email_marketing BOOLEAN DEFAULT FALSE,
    push_enabled BOOLEAN DEFAULT TRUE,
    push_account BOOLEAN DEFAULT TRUE,
    push_game BOOLEAN DEFAULT TRUE,
    push_billing BOOLEAN DEFAULT TRUE,
    push_system BOOLEAN DEFAULT TRUE,
    in_app_enabled BOOLEAN DEFAULT TRUE,
    in_app_account BOOLEAN DEFAULT TRUE,
    in_app_game BOOLEAN DEFAULT TRUE,
    in_app_billing BOOLEAN DEFAULT TRUE,
    in_app_system BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Push device tokens table (for FCM/APNS)
CREATE TABLE push_device_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_token TEXT NOT NULL,
    device_type VARCHAR(20) NOT NULL CHECK (device_type IN ('ios', 'android', 'web')),
    device_id VARCHAR(255),
    active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User friends table (for social features)
CREATE TABLE user_friends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, friend_id),
    CHECK (user_id != friend_id)
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_last_activity ON users(last_activity_at);

CREATE INDEX idx_user_sessions_token ON user_sessions(token);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

CREATE INDEX idx_login_attempts_ip_created ON login_attempts(ip_address, created_at);
CREATE INDEX idx_login_attempts_identifier_created ON login_attempts(identifier, created_at);

CREATE INDEX idx_password_reset_token ON password_reset_requests(token);
CREATE INDEX idx_password_reset_expires ON password_reset_requests(expires_at);

CREATE INDEX idx_email_verification_token ON email_verifications(token);
CREATE INDEX idx_email_verification_expires ON email_verifications(expires_at);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

CREATE INDEX idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX idx_payment_methods_stripe_id ON payment_methods(stripe_payment_method_id);

CREATE INDEX idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX idx_invoices_stripe_id ON invoices(stripe_invoice_id);
CREATE INDEX idx_invoices_status ON invoices(status);

CREATE INDEX idx_usage_records_user_id ON usage_records(user_id);
CREATE INDEX idx_usage_records_period ON usage_records(period_start, period_end);
CREATE INDEX idx_usage_records_metric ON usage_records(metric_type);

CREATE INDEX idx_email_notifications_user_id ON email_notifications(user_id);
CREATE INDEX idx_email_notifications_status ON email_notifications(status);
CREATE INDEX idx_email_notifications_created ON email_notifications(created_at);

CREATE INDEX idx_push_notifications_user_id ON push_notifications(user_id);
CREATE INDEX idx_push_notifications_status ON push_notifications(status);
CREATE INDEX idx_push_notifications_created ON push_notifications(created_at);

CREATE INDEX idx_in_app_notifications_user_id ON in_app_notifications(user_id);
CREATE INDEX idx_in_app_notifications_read ON in_app_notifications(user_id, read);
CREATE INDEX idx_in_app_notifications_expires ON in_app_notifications(expires_at);

CREATE INDEX idx_push_device_tokens_user_id ON push_device_tokens(user_id);
CREATE INDEX idx_push_device_tokens_active ON push_device_tokens(active);

CREATE INDEX idx_user_friends_user_id ON user_friends(user_id);
CREATE INDEX idx_user_friends_status ON user_friends(user_id, status);

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_templates_updated_at BEFORE UPDATE ON notification_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default subscription plans
INSERT INTO subscription_plans (id, name, tier, price, currency, interval, features, limits) VALUES
('free', 'Free', 'free', 0.00, 'USD', 'month', 
 '["2 campaigns", "4 players per game", "1GB storage", "50 assets", "Basic features"]',
 '{"maxCampaigns": 2, "maxPlayersPerGame": 4, "maxStorageGB": 1, "maxAssets": 50, "canUseCustomAssets": false, "canUseAdvancedFeatures": false}'),

('basic', 'Basic', 'basic', 9.99, 'USD', 'month',
 '["5 campaigns", "8 players per game", "5GB storage", "500 assets", "Custom assets", "Priority support"]',
 '{"maxCampaigns": 5, "maxPlayersPerGame": 8, "maxStorageGB": 5, "maxAssets": 500, "canUseCustomAssets": true, "canUseAdvancedFeatures": false}'),

('premium', 'Premium', 'premium', 19.99, 'USD', 'month',
 '["20 campaigns", "12 players per game", "25GB storage", "5,000 assets", "Custom assets", "Advanced features", "API access", "Premium support"]',
 '{"maxCampaigns": 20, "maxPlayersPerGame": 12, "maxStorageGB": 25, "maxAssets": 5000, "canUseCustomAssets": true, "canUseAdvancedFeatures": true}'),

('enterprise', 'Enterprise', 'enterprise', 49.99, 'USD', 'month',
 '["Unlimited campaigns", "Unlimited players", "100GB storage", "Unlimited assets", "Custom assets", "All advanced features", "Full API access", "Dedicated support", "Custom integrations"]',
 '{"maxCampaigns": -1, "maxPlayersPerGame": -1, "maxStorageGB": 100, "maxAssets": -1, "canUseCustomAssets": true, "canUseAdvancedFeatures": true}');

-- Insert default notification templates
INSERT INTO notification_templates (id, name, type, category, subject, html_template, text_template, variables) VALUES
('welcome', 'Welcome Email', 'email', 'account', 
 'Welcome to {{ appName }}!',
 '<h1>Welcome, {{ firstName }}!</h1><p>Thank you for joining {{ appName }}. We''re excited to have you on board!</p><p>Your username is: <strong>{{ username }}</strong></p><p><a href="{{ loginUrl }}">Get started by logging in</a></p>',
 'Welcome, {{ firstName }}! Thank you for joining {{ appName }}. Your username is: {{ username }}. Get started by logging in: {{ loginUrl }}',
 ARRAY['firstName', 'username', 'appName', 'loginUrl']),

('password-reset', 'Password Reset', 'email', 'account',
 'Reset your password',
 '<h1>Password Reset Request</h1><p>Hi {{ firstName }},</p><p>Click the link below to reset your password:</p><p><a href="{{ resetUrl }}">Reset Password</a></p><p>This link will expire in {{ expiresIn }}.</p>',
 'Password Reset Request. Hi {{ firstName }}, Visit this link to reset your password: {{ resetUrl }}. This link will expire in {{ expiresIn }}.',
 ARRAY['firstName', 'resetUrl', 'expiresIn']),

('email-verification', 'Email Verification', 'email', 'account',
 'Verify your email address',
 '<h1>Verify Your Email</h1><p>Hi {{ firstName }},</p><p>Please verify your email address by clicking the link below:</p><p><a href="{{ verificationUrl }}">Verify Email</a></p>',
 'Verify Your Email. Hi {{ firstName }}, Please verify your email address by visiting this link: {{ verificationUrl }}',
 ARRAY['firstName', 'verificationUrl']),

('game-invite', 'Game Invitation', 'email', 'game',
 'You''re invited to play {{ gameTitle }}!',
 '<h1>Game Invitation</h1><p>{{ inviterName }} has invited you to play <strong>{{ gameTitle }}</strong>!</p><p><a href="{{ acceptUrl }}">Accept</a> | <a href="{{ declineUrl }}">Decline</a></p>',
 'Game Invitation. {{ inviterName }} has invited you to play {{ gameTitle }}! Accept: {{ acceptUrl }} Decline: {{ declineUrl }}',
 ARRAY['inviterName', 'gameTitle', 'acceptUrl', 'declineUrl', 'gameUrl']),

('payment-failed', 'Payment Failed', 'email', 'billing',
 'Payment failed - Action required',
 '<h1>Payment Failed</h1><p>We were unable to process your payment of {{ amount }} {{ currency }}.</p><p><a href="{{ retryUrl }}">Update Payment Method</a></p>',
 'Payment Failed. We were unable to process your payment of {{ amount }} {{ currency }}. Update Payment Method: {{ retryUrl }}',
 ARRAY['amount', 'currency', 'retryUrl']);
