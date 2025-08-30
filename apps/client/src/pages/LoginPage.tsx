/**
 * Login Page - User authentication interface
 */

import React, { useState } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
// LoadingSpinner not used on this page; remove import to avoid unused var
import { Eye, EyeOff, Github, Mail } from 'lucide-react';
import { useTranslation } from '@vtt/i18n';

interface LoginPageProps {
  router: {
    navigate: (path: string, replace?: boolean) => void;
    currentPath: string;
  };
}

export function LoginPage({ router }: LoginPageProps) {
  const { t } = useTranslation();
  const { login,  loginWithProvider,  isLoading,  error,  clearError  } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    
    if (!validateForm()) return;
    
    try {
      await login(formData.email, formData.password);
      // Navigation will be handled by the Router component based on auth state
    } catch (_error) {
      // Error is handled by the AuthProvider
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
    }
    clearError();
  };

  const handleOAuthLogin = (provider: 'discord' | 'google') => {
    clearError();
    loginWithProvider(provider);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Welcome Back
          </h1>
          <p className="text-text-secondary">
            Sign in to your Virtual Tabletop account
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-bg-secondary rounded-xl border border-border-primary p-6 shadow-lg">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-error-light border border-error rounded-lg">
              <p className="text-error text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" role="form">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="Enter your email"
                error={validationErrors.email}
                leftIcon={<Mail className="h-4 w-4" />}
                disabled={isLoading}
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-primary mb-1">
                Password
              </label>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder="Enter your password"
                error={validationErrors.password}
                disabled={isLoading}
                rightIcon={
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
            </div>

            {/* Forgot Password Link */}
            <div className="text-right">
              <button
                type="button"
                aria-label="Forgot password"
                onClick={() => router.navigate('/forgot-password')}
                className="text-sm text-accent-primary hover:text-accent-hover transition-colors"
                disabled={isLoading}
              >
                Forgot your password?
              </button>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
              disabled={isLoading}
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-border-primary"></div>
            <span className="px-3 text-sm text-text-secondary">Or continue with</span>
            <div className="flex-1 border-t border-border-primary"></div>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-3">
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              leftIcon={<Github className="h-4 w-4" />}
              onClick={() => handleOAuthLogin('discord')}
              disabled={isLoading}
            >
              Continue with Discord
            </Button>
            
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              leftIcon={
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              }
              onClick={() => handleOAuthLogin('google')}
              disabled={isLoading}
            >
              Continue with Google
            </Button>
          </div>

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-text-secondary">
              Don't have an account?{' '}
              <button
                aria-label="Go to register"
                onClick={() => router.navigate('/register')}
                className="text-accent-primary hover:text-accent-hover font-medium transition-colors"
                disabled={isLoading}
              >
                Sign up
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-text-tertiary">
            By signing in, you agree to our{' '}
            <a href="/terms" className="text-accent-primary hover:text-accent-hover">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" className="text-accent-primary hover:text-accent-hover">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
