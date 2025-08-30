/**
 * Registration Form - Comprehensive signup form with validation and terms acceptance
 */
import React, { useState } from 'react';
import { logger } from '@vtt/logging';
// import { useRouter } from 'next/router'; // Next.js router not available in this project
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, Check} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { useAuth, type RegisterData } from '../../providers/AuthProvider';
import { cn, isValidEmail } from '../../lib/utils';

// Simple password validation function
function validatePassword(password: string): { isValid: boolean; score: number; feedback: string[] } {
  const feedback: string[] = [];
  let score = 0;
  
  if (password.length < 8) {
    feedback.push('Password must be at least 8 characters');
  } else {
    score++;
  }
  
  if (!/[A-Z]/.test(password)) {
    feedback.push('Include at least one uppercase letter');
  } else {
    score++;
  }
  
  if (!/[a-z]/.test(password)) {
    feedback.push('Include at least one lowercase letter');
  } else {
    score++;
  }
  
  if (!/[0-9]/.test(password)) {
    feedback.push('Include at least one number');
  } else {
    score++;
  }
  
  if (!/[^A-Za-z0-9]/.test(password)) {
    feedback.push('Include at least one special character');
  } else {
    score++;
  }
  
  return {
    isValid: feedback.length === 0,
    score,
    feedback
  };
}

interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  timezone: string;
  acceptedTerms: boolean;
}

interface RegisterFormErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  firstName?: string;
  lastName?: string;
  acceptedTerms?: string;
  general?: string;
}

export function RegisterForm() {
  // Router not available in this project
  const { register, isLoading, error, clearError } = useAuth();
  
  const [formData, setFormData] = useState<RegisterFormData>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    acceptedTerms: false,
  });
  
  const [errors, setErrors] = useState<RegisterFormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, feedback: [] as string[] });

  // Handle input changes
  const handleChange = (field: keyof RegisterFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field-specific errors
    if (errors[field as keyof RegisterFormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    
    // Clear general errors
    if (error) {
      clearError();
    }

    // Update password strength on password change
    if (field === 'password' && typeof value === 'string') {
      setPasswordStrength(validatePassword(value));
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: RegisterFormErrors = {};

    // Username validation
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, dashes, and underscores';
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!isValidEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // First name validation
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    // Last name validation
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    // Password validation
    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      newErrors.password = passwordValidation.feedback[0] || 'Password does not meet requirements';
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Terms acceptance validation
    if (!formData.acceptedTerms) {
      newErrors.acceptedTerms = 'You must accept the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      const { confirmPassword: _confirmPassword, ...registerData } = formData;
      await register(registerData as RegisterData);
      
      // Redirect to dashboard on success
      window.location.href = '/dashboard';
    } catch (err) {
      logger.error('Registration failed:', err);
    }
  };

  // Password strength indicator
  const getPasswordStrengthColor = (score: number) => {
    if (score < 2) return 'bg-error-500';
    if (score < 4) return 'bg-warning-500';
    return 'bg-success-500';
  };

  const getPasswordStrengthText = (score: number) => {
    if (score === 0) return 'Very Weak';
    if (score === 1) return 'Weak';
    if (score === 2) return 'Fair';
    if (score === 3) return 'Good';
    if (score === 4) return 'Strong';
    return 'Very Strong';
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">Create your account</CardTitle>
        <CardDescription>
          Join the adventure and start your tabletop journey
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4" role="form">
          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First Name"
              type="text"
              placeholder="John"
              value={formData.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              error={errors.firstName}
              disabled={isLoading}
              autoComplete="given-name"
            />
            <Input
              label="Last Name"
              type="text"
              placeholder="Doe"
              value={formData.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              error={errors.lastName}
              disabled={isLoading}
              autoComplete="family-name"
            />
          </div>

          {/* Username Field */}
          <Input
            label="Username"
            type="text"
            placeholder="Choose a unique username"
            value={formData.username}
            onChange={(e) => handleChange('username', e.target.value)}
            error={errors.username}
            leftIcon={<User className="h-4 w-4" />}
            disabled={isLoading}
            autoComplete="username"
          />

          {/* Email Field */}
          <Input
            label="Email"
            type="email"
            placeholder="Enter your email address"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            error={errors.email}
            leftIcon={<Mail className="h-4 w-4" />}
            disabled={isLoading}
            autoComplete="email"
          />

          {/* Password Field */}
          <div className="space-y-2">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a strong password"
              value={formData.password}
              onChange={(e) => handleChange('password', e.target.value)}
              error={errors.password}
              leftIcon={<Lock className="h-4 w-4" />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-neutral-400 hover:text-neutral-600 focus:outline-none"
                  tabIndex={0}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
              disabled={isLoading}
              autoComplete="new-password"
            />
            
            {/* Password Strength Indicator */}
            {formData.password && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-600">Password strength</span>
                  <span className={cn(
                    "font-medium",
                    passwordStrength.score < 2 ? 'text-error-600' :
                    passwordStrength.score < 4 ? 'text-warning-600' : 'text-success-600'
                  )}>
                    {getPasswordStrengthText(passwordStrength.score)}
                  </span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-1.5">
                  <div
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      getPasswordStrengthColor(passwordStrength.score)
                    )}
                    style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password Field */}
          <Input
            label="Confirm Password"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="Confirm your password"
            value={formData.confirmPassword}
            onChange={(e) => handleChange('confirmPassword', e.target.value)}
            error={errors.confirmPassword}
            leftIcon={<Lock className="h-4 w-4" />}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="text-neutral-400 hover:text-neutral-600 focus:outline-none"
                tabIndex={0}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
            disabled={isLoading}
            autoComplete="new-password"
          />

          {/* Terms Acceptance */}
          <div className="space-y-2">
            <label className="flex items-start space-x-2 text-sm">
              <input
                type="checkbox"
                checked={formData.acceptedTerms}
                onChange={(e) => handleChange('acceptedTerms', e.target.checked)}
                className={cn(
                  "mt-1 rounded border-neutral-300 text-primary-600 focus:ring-primary-500",
                  errors.acceptedTerms && "border-error-300"
                )}
                disabled={isLoading}
              />
              <span className="text-neutral-700 leading-relaxed">
                I agree to the{' '}
                <a href="/terms" target="_blank" className="text-primary-600 hover:underline font-medium">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy" target="_blank" className="text-primary-600 hover:underline font-medium">
                  Privacy Policy
                </a>
              </span>
            </label>
            {errors.acceptedTerms && (
              <p className="text-xs text-error-600">{errors.acceptedTerms}</p>
            )}
          </div>

          {/* General Error Message */}
          {error && (
            <div className="p-3 text-sm text-error-700 bg-error-50 border border-error-200 rounded-lg">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading}
            rightIcon={!isLoading && <ArrowRight className="h-4 w-4" />}
          >
            {isLoading ? 'Creating account...' : 'Create account'}
          </Button>
        </form>

        {/* Sign In Link */}
        <div className="text-center text-sm text-neutral-600">
          Already have an account?{' '}
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => window.location.href = '/auth/login'}
            disabled={isLoading}
            className="font-medium"
          >
            Sign in
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
