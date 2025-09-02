/**
 * Email Template Definitions - Professional VTT Platform Templates
 */

export const EMAIL_TEMPLATES = {
  'email-verification': {
    subject: 'Verify Your VTT Platform Account',
    htmlContent: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: white; }
        .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
        .content { padding: 40px 30px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 30px; text-align: center; color: #666; font-size: 14px; }
        .security-note { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🎲 VTT Platform</div>
            <p>Welcome to the ultimate virtual tabletop experience</p>
        </div>
        <div class="content">
            <h2>Verify Your Email Address</h2>
            <p>Hi {{recipientName}},</p>
            <p>Thank you for joining VTT Platform! To complete your account setup and start your epic gaming adventures, please verify your email address.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{{verificationUrl}}" class="button">Verify Email Address</a>
            </div>
            
            <div class="security-note">
                <strong>🔒 Security Note:</strong> This verification link expires in 24 hours for your security. If you didn't create an account with VTT Platform, please ignore this email.
            </div>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace;">{{verificationUrl}}</p>
            
            <p>Once verified, you'll be able to:</p>
            <ul>
                <li>Create and join gaming campaigns</li>
                <li>Use advanced VTT features</li>
                <li>Connect with fellow gamers</li>
                <li>Access AI-powered game content</li>
            </ul>
        </div>
        <div class="footer">
            <p>VTT Platform - Where Epic Adventures Begin</p>
            <p>If you have questions, contact our support team at support@vttplatform.com</p>
        </div>
    </div>
</body>
</html>`,
    textContent: `
VTT Platform - Email Verification

Hi {{recipientName}},

Thank you for joining VTT Platform! To complete your account setup, please verify your email address by clicking the link below:

{{verificationUrl}}

This verification link expires in 24 hours for your security.

Once verified, you'll be able to:
- Create and join gaming campaigns
- Use advanced VTT features  
- Connect with fellow gamers
- Access AI-powered game content

If you didn't create an account with VTT Platform, please ignore this email.

Questions? Contact support@vttplatform.com

VTT Platform - Where Epic Adventures Begin
`,
    variables: {}
  },

  'password-reset': {
    subject: 'Reset Your VTT Platform Password',
    htmlContent: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: white; }
        .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
        .content { padding: 40px 30px; }
        .button { display: inline-block; background: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 30px; text-align: center; color: #666; font-size: 14px; }
        .warning { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 4px; margin: 20px 0; color: #721c24; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🎲 VTT Platform</div>
            <p>Account Security</p>
        </div>
        <div class="content">
            <h2>Reset Your Password</h2>
            <p>Hi {{recipientName}},</p>
            <p>We received a request to reset your password for your VTT Platform account. If you made this request, click the button below to reset your password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{{resetUrl}}" class="button">Reset Password</a>
            </div>
            
            <div class="warning">
                <strong>⚠️ Important:</strong> This password reset link expires in 1 hour for security reasons. If you didn't request a password reset, please ignore this email and your password will remain unchanged.
            </div>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace;">{{resetUrl}}</p>
            
            <p><strong>Security Tips:</strong></p>
            <ul>
                <li>Choose a strong, unique password</li>
                <li>Don't reuse passwords from other sites</li>
                <li>Consider enabling two-factor authentication</li>
            </ul>
        </div>
        <div class="footer">
            <p>VTT Platform Security Team</p>
            <p>If you suspect unauthorized access, contact security@vttplatform.com immediately</p>
        </div>
    </div>
</body>
</html>`,
    textContent: `
VTT Platform - Password Reset

Hi {{recipientName}},

We received a request to reset your password for your VTT Platform account.

Reset your password here: {{resetUrl}}

This link expires in 1 hour for security reasons.

If you didn't request a password reset, please ignore this email.

Security Tips:
- Choose a strong, unique password
- Don't reuse passwords from other sites  
- Consider enabling two-factor authentication

Questions? Contact security@vttplatform.com

VTT Platform Security Team
`,
    variables: {}
  },

  'welcome': {
    subject: 'Welcome to VTT Platform - Your Adventure Begins!',
    htmlContent: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to VTT Platform</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: white; }
        .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
        .content { padding: 40px 30px; }
        .button { display: inline-block; background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .feature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0; }
        .feature { padding: 20px; background: #f8f9fa; border-radius: 6px; text-align: center; }
        .footer { background: #f8f9fa; padding: 30px; text-align: center; color: #666; font-size: 14px; }
        @media (max-width: 600px) { .feature-grid { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🎲 VTT Platform</div>
            <p>Welcome to Your Epic Adventure!</p>
        </div>
        <div class="content">
            <h2>Welcome, {{recipientName}}! 🎉</h2>
            <p>Congratulations on joining VTT Platform! Your account <strong>{{username}}</strong> is now ready, and you're about to embark on incredible virtual tabletop adventures.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{{dashboardUrl}}" class="button">Enter Your Dashboard</a>
            </div>
            
            <h3>🚀 What You Can Do Now:</h3>
            <div class="feature-grid">
                <div class="feature">
                    <h4>🗺️ Create Campaigns</h4>
                    <p>Build immersive worlds and manage your adventures</p>
                </div>
                <div class="feature">
                    <h4>🎭 AI-Powered NPCs</h4>
                    <p>Generate dynamic characters and storylines</p>
                </div>
                <div class="feature">
                    <h4>🎲 Advanced Tools</h4>
                    <p>Dice rolling, combat tracker, and more</p>
                </div>
                <div class="feature">
                    <h4>👥 Community</h4>
                    <p>Connect with players and game masters</p>
                </div>
            </div>
            
            <h3>🎯 Quick Start Guide:</h3>
            <ol>
                <li><strong>Complete your profile</strong> - Add an avatar and preferences</li>
                <li><strong>Join a game</strong> - Browse public campaigns or get invited</li>
                <li><strong>Create your first campaign</strong> - Use our campaign wizard</li>
                <li><strong>Explore AI features</strong> - Generate content automatically</li>
            </ol>
            
            <p>Need help getting started? Check out our <a href="{{baseUrl}}/docs">documentation</a> or join our <a href="{{baseUrl}}/community">community discord</a>.</p>
        </div>
        <div class="footer">
            <p>Ready to roll for initiative? Your adventure awaits!</p>
            <p>VTT Platform Team | support@vttplatform.com</p>
        </div>
    </div>
</body>
</html>`,
    textContent: `
Welcome to VTT Platform!

Hi {{recipientName}},

Congratulations on joining VTT Platform! Your account {{username}} is ready.

Get started: {{dashboardUrl}}

What You Can Do:
🗺️ Create immersive campaigns and worlds
🎭 Use AI-powered NPCs and storylines  
🎲 Access advanced tabletop tools
👥 Connect with the gaming community

Quick Start:
1. Complete your profile
2. Join a game or create a campaign
3. Explore our AI features
4. Connect with other players

Need help? Visit our docs or join our community discord.

Ready to roll for initiative?

VTT Platform Team
support@vttplatform.com
`,
    variables: {}
  },

  'campaign-invite': {
    subject: 'You\'re Invited to Join {{campaignName}} on VTT Platform!',
    htmlContent: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Campaign Invitation</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: white; }
        .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
        .content { padding: 40px 30px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .campaign-info { background: #e3f2fd; padding: 20px; border-radius: 6px; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 30px; text-align: center; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🎲 VTT Platform</div>
            <p>Campaign Invitation</p>
        </div>
        <div class="content">
            <h2>🎯 You're Invited to Join an Adventure!</h2>
            <p>Hi {{recipientName}},</p>
            <p><strong>{{gmName}}</strong> has invited you to join their campaign on VTT Platform:</p>
            
            <div class="campaign-info">
                <h3>{{campaignName}}</h3>
                <p><strong>Game Master:</strong> {{gmName}}</p>
                <p><strong>System:</strong> {{gameSystem}}</p>
                <p><strong>Schedule:</strong> {{schedule}}</p>
                <p><strong>Players:</strong> {{currentPlayers}}/{{maxPlayers}}</p>
                {{#campaignDescription}}
                <p><strong>Description:</strong> {{campaignDescription}}</p>
                {{/campaignDescription}}
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{{joinUrl}}" class="button">Join Campaign</a>
            </div>
            
            <p>This invitation expires in 7 days. Don't miss out on the adventure!</p>
        </div>
        <div class="footer">
            <p>VTT Platform - Where Epic Adventures Begin</p>
        </div>
    </div>
</body>
</html>`,
    textContent: `
VTT Platform - Campaign Invitation

Hi {{recipientName}},

{{gmName}} has invited you to join their campaign:

{{campaignName}}
Game Master: {{gmName}}
System: {{gameSystem}}
Schedule: {{schedule}}
Players: {{currentPlayers}}/{{maxPlayers}}

{{#campaignDescription}}
Description: {{campaignDescription}}
{{/campaignDescription}}

Join here: {{joinUrl}}

This invitation expires in 7 days.

VTT Platform
`,
    variables: {}
  }
};
