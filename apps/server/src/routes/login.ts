/**
 * Login page route handler
 */

import { RouteHandler } from "../router/types";

export const loginPageHandler: RouteHandler = async (ctx) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VTT Platform - Login</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 0;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .login-container {
            background: white;
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
            width: 90%;
        }
        .logo {
            font-size: 2rem;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 1rem;
        }
        .subtitle {
            color: #666;
            margin-bottom: 2rem;
        }
        .oauth-button {
            display: block;
            width: 100%;
            padding: 12px 20px;
            margin: 10px 0;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 500;
            text-decoration: none;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .discord-btn {
            background: #5865F2;
            color: white;
        }
        .discord-btn:hover {
            background: #4752C4;
            transform: translateY(-1px);
        }
        .google-btn {
            background: #fff;
            color: #333;
            border: 1px solid #ddd;
        }
        .google-btn:hover {
            background: #f8f9fa;
            transform: translateY(-1px);
        }
        .error {
            background: #fee;
            color: #c33;
            padding: 10px;
            border-radius: 6px;
            margin-bottom: 1rem;
            border: 1px solid #fcc;
        }
        .divider {
            margin: 1.5rem 0;
            position: relative;
            text-align: center;
        }
        .divider::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 0;
            right: 0;
            height: 1px;
            background: #ddd;
        }
        .divider span {
            background: white;
            padding: 0 1rem;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">🎲 VTT Platform</div>
        <div class="subtitle">Sign in to continue to your virtual tabletop</div>
        
        ${ctx.url.searchParams.get('error') ? `
        <div class="error">
            ${getErrorMessage(ctx.url.searchParams.get('error'))}
        </div>
        ` : ''}
        
        <a href="/auth/discord" class="oauth-button discord-btn">
            Continue with Discord
        </a>
        
        <div class="divider">
            <span>or</span>
        </div>
        
        <a href="/auth/google" class="oauth-button google-btn">
            Continue with Google
        </a>
        
        <div style="margin-top: 2rem; font-size: 0.9rem; color: #666;">
            New to VTT Platform? Signing in will create your account automatically.
        </div>
    </div>
</body>
</html>
  `;

  ctx.res.writeHead(200, { 'Content-Type': 'text/html' });
  ctx.res.end(html);
};

function getErrorMessage(error: string | null): string {
  switch (error) {
    case 'discord_auth_failed':
      return 'Discord authentication failed. Please try again.';
    case 'google_auth_failed':
      return 'Google authentication failed. Please try again.';
    case 'auth_callback_failed':
      return 'Authentication callback failed. Please try again.';
    default:
      return 'An authentication error occurred. Please try again.';
  }
}
