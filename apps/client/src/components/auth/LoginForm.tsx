/**
 * Login Form - Elegant authentication form with validation and error handling
 */
import React, { useState } from "react";
import { logger } from "@vtt/logging";
import { toErrorObject } from "../../utils/error-utils";
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, Shield, AlertCircle, ArrowRight, Chrome, Github } from 'lucide-react';
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/Card";
import { useAuth } from "../../providers/AuthProvider";
import { isValidEmail } from "../../lib/utils";
// Translation hook removed - using inline translations for now

interface LoginFormData {
  identifier: string;
  password: string;
  rememberMe: boolean;
}

interface LoginFormErrors {
  identifier?: string;
  password?: string;
  general?: string;
}

export function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading: loading, error, clearError } = useAuth();
  // Translation function for auth strings
  const t = (key: string) => {
    const translations: Record<string, string> = {
      'login.title': 'Sign In',
      'login.subtitle': 'Welcome back! Please sign in to continue.',
      'login.google': 'Google',
      'login.github': 'GitHub',
      'login.orContinueWith': 'or continue with',
      'login.emailOrUsername': 'Email or Username',
      'login.emailOrUsernamePlaceholder': 'Enter your email or username',
      'login.password': 'Password',
      'login.passwordPlaceholder': 'Enter your password',
      'login.togglePasswordVisibility': 'Toggle password visibility',
      'login.rememberMe': 'Remember me',
      'login.forgotPassword': 'Forgot password?',
      'login.signingIn': 'Signing in...',
      'login.signIn': 'Sign In',
      'login.dontHaveAccount': "Don't have an account?",
      'login.signUp': 'Sign up',
      'validation.emailOrUsernameRequired': 'Email or username is required',
      'validation.validEmailRequired': 'Please enter a valid email',
      'validation.passwordRequired': 'Password is required',
      'validation.passwordMinLength': 'Password must be at least 6 characters'
    };
    return translations[key] || key;
  };

  const [formData, setFormData] = useState<LoginFormData>({
    identifier: "",
    password: "",
    rememberMe: false,
  });

  const [errors, setErrors] = useState<LoginFormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle input changes
  const handleChange = (field: keyof LoginFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear field-specific errors when user starts typing
    if (errors[field as keyof LoginFormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }

    // Clear general errors
    if (error) {
      clearError();
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: LoginFormErrors = {};

    if (!formData.identifier.trim()) {
      newErrors.identifier = t("validation.emailOrUsernameRequired");
    } else if (formData.identifier.includes("@") && !isValidEmail(formData.identifier)) {
      newErrors.identifier = t("validation.validEmailRequired");
    }

    if (!formData.password) {
      newErrors.password = t("validation.passwordRequired");
    } else if (formData.password.length < 6) {
      newErrors.password = t("validation.passwordMinLength");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {return;}

    setIsSubmitting(true);
    setErrors({});

    try {
      // For email login, extract email from identifier
      const email = formData.identifier.includes('@') ? formData.identifier : `${formData.identifier}@example.com`;
      await login(email, formData.password);

      // Redirect to dashboard or intended page
      const searchParams = new URLSearchParams(location.search);
      const redirectTo = searchParams.get("redirect") || "/dashboard";
      navigate(redirectTo);
    } catch (error) {
      logger.error("Login failed:", toErrorObject(error));
      
      // Set form-specific error if needed
      if (error instanceof Error) {
        setErrors({ general: error.message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle social login
  const handleSocialLogin = (provider: "google" | "github") => {
    // Redirect to OAuth provider
    const redirectUri = encodeURIComponent(`${window.location.origin  }/auth/callback`);
    window.location.href = `/api/auth/${provider}?redirect_uri=${redirectUri}`;
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">{t("login.title")}</CardTitle>
        <CardDescription>{t("login.subtitle")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Social Login Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            onClick={() => handleSocialLogin("google")}
          >
            {t("login.google")}
          </Button>
          <Button
            type="button"
            onClick={() => handleSocialLogin("github")}
          >
            {t("login.github")}
          </Button>
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-neutral-300" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-neutral-500">{t("login.orContinueWith")}</span>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4" role="form">
          {/* Email/Username Field */}
          <Input
            label={t("login.emailOrUsername")}
            type="text"
            placeholder={t("login.emailOrUsernamePlaceholder")}
            value={formData.identifier}
            onChange={(e) => handleChange("identifier", e.target.value)}
            error={errors.identifier}
            leftIcon={<User className="h-4 w-4" />}
            disabled={loading}
            autoComplete="username"
            autoFocus
          />

          {/* Password Field */}
          <Input
            label={t("login.password")}
            type={showPassword ? "text" : "password"}
            placeholder={t("login.passwordPlaceholder")}
            value={formData.password}
            onChange={(e) => handleChange("password", e.target.value)}
            error={errors.password}
            leftIcon={<Lock className="h-4 w-4" />}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-neutral-400 hover:text-neutral-600 focus:outline-none"
                aria-label={t("login.togglePasswordVisibility")}
                tabIndex={0}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
            disabled={loading}
            autoComplete="current-password"
          />

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={formData.rememberMe}
                onChange={(e) => handleChange("rememberMe", e.target.checked)}
                className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-neutral-700">{t("login.rememberMe")}</span>
            </label>

            <Button
              type="button"
              onClick={() => navigate('/auth/forgot-password')}
              className="text-sm"
            >
              {t("login.forgotPassword")}
            </Button>
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
            disabled={loading || isSubmitting}
          >
            {(loading || isSubmitting) ? t("login.signingIn") : t("login.signIn")}
          </Button>
        </form>

        {/* Sign Up Link */}
        <div className="text-center text-sm text-neutral-600">
          {t("login.dontHaveAccount")}{" "}
          <Button
            type="button"
            onClick={() => navigate('/auth/register')}
            disabled={isSubmitting}
            className="text-primary-600 hover:text-primary-700"
          >
            {t("login.signUp")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default LoginForm;
