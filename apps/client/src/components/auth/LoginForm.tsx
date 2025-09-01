/**
 * Login Form - Elegant authentication form with validation and error handling
 */
import React, { useState } from "react";
import { logger } from "@vtt/logging";
import { useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, ArrowRight, Github, Chrome } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/Card";
import { useAuth } from "../../providers/AuthProvider";
import { isValidEmail } from "../../lib/utils";
import { useAuthTranslation } from "../../hooks/useTranslation";

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
  const { t } = useAuthTranslation();

  const [formData, setFormData] = useState<LoginFormData>({
    identifier: "",
    password: "",
    rememberMe: false,
  });

  const [errors, setErrors] = useState<LoginFormErrors>({});
  const [showPassword, setShowPassword] = useState(false);

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

    if (!validateForm()) return;

    try {
      await login(formData.identifier, formData.password);

      // Redirect to dashboard or intended page
      const searchParams = new URLSearchParams(location.search);
      const redirectTo = searchParams.get("redirect") || "/dashboard";
      navigate(redirectTo);
    } catch (err) {
      // Error is handled by useAuth hook
      logger.error("Login failed:", err);
    }
  };

  // Handle social login
  const handleSocialLogin = (provider: "google" | "github") => {
    // Redirect to OAuth provider
    const redirectUri = encodeURIComponent(window.location.origin + "/auth/callback");
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
            variant="secondary"
            size="md"
            onClick={() => handleSocialLogin("google")}
            leftIcon={<Chrome className="h-4 w-4" />}
          >
            {t("login.google")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => handleSocialLogin("github")}
            leftIcon={<Github className="h-4 w-4" />}
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
            leftIcon={<Mail className="h-4 w-4" />}
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
                disabled={loading}
              />
              <span className="text-neutral-700">{t("login.rememberMe")}</span>
            </label>

            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => navigate("/auth/forgot-password")}
              disabled={loading}
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
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            rightIcon={!loading && <ArrowRight className="h-4 w-4" />}
          >
            {loading ? t("login.signingIn") : t("login.signIn")}
          </Button>
        </form>

        {/* Sign Up Link */}
        <div className="text-center text-sm text-neutral-600">
          {t("login.dontHaveAccount")}{" "}
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => navigate("/auth/register")}
            disabled={loading}
            className="font-medium"
          >
            {t("login.signUp")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default LoginForm;
