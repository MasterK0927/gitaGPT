import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Check, X, AlertCircle, User, Mail, Lock, Lightbulb, Loader2 } from 'lucide-react';
import { useSignIn, useSignUp } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useUsernameValidation } from '../../hooks/useUsernameValidation';
import { useDebouncedValidation } from '../../hooks/useDebounce';

interface RobustAuthFormProps {
  type: 'login' | 'register';
}

interface ValidationState {
  isValid: boolean;
  message: string;
  type: 'success' | 'error' | 'warning' | 'checking';
  isChecking?: boolean;
}

interface PasswordRequirement {
  id: string;
  label: string;
  test: (password: string) => boolean;
  met: boolean;
}

export const RobustAuthForm: React.FC<RobustAuthFormProps> = ({ type }) => {
  const { signIn, setActive } = useSignIn();
  const { signUp, setActive: setActiveSignUp } = useSignUp();
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationStep, setVerificationStep] = useState<'form' | 'email-verification' | 'complete'>('form');
  const [verificationCode, setVerificationCode] = useState('');

  // Debounced validation states
  const emailDebounce = useDebouncedValidation(formData.email, 300);
  const usernameDebounce = useDebouncedValidation(formData.username, 400);
  const passwordDebounce = useDebouncedValidation(formData.password, 200);
  const confirmPasswordDebounce = useDebouncedValidation(formData.confirmPassword, 200);

  // Validation states
  const [emailValidation, setEmailValidation] = useState<ValidationState>({ isValid: false, message: '', type: 'error' });
  const usernameValidation = useUsernameValidation(
    usernameDebounce.debouncedValue,
    formData.email, // Use current email value, not debounced
    usernameDebounce.shouldShowValidation && type === 'register'
  );
  const [passwordRequirements, setPasswordRequirements] = useState<PasswordRequirement[]>([
    { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8, met: false },
    { id: 'uppercase', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p), met: false },
    { id: 'lowercase', label: 'One lowercase letter', test: (p) => /[a-z]/.test(p), met: false },
    { id: 'number', label: 'One number', test: (p) => /\d/.test(p), met: false },
    { id: 'special', label: 'One special character', test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p), met: false }
  ]);
  const [confirmPasswordValidation, setConfirmPasswordValidation] = useState<ValidationState>({ isValid: false, message: '', type: 'error' });

  // Email validation with debouncing
  useEffect(() => {
    if (!emailDebounce.shouldShowValidation || !emailDebounce.debouncedValue.trim()) {
      setEmailValidation({ isValid: false, message: '', type: 'error' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValidEmail = emailRegex.test(emailDebounce.debouncedValue);

    if (!isValidEmail) {
      setEmailValidation({ isValid: false, message: 'Please enter a valid email address', type: 'error' });
    } else {
      setEmailValidation({ isValid: true, message: 'Valid email address', type: 'success' });
    }
  }, [emailDebounce.debouncedValue, emailDebounce.shouldShowValidation]);



  // Password validation with debouncing
  useEffect(() => {
    if (type === 'login' || !passwordDebounce.shouldShowValidation || !passwordDebounce.debouncedValue) {
      setPasswordRequirements(prev => prev.map(req => ({ ...req, met: false })));
      return;
    }

    setPasswordRequirements(prev =>
      prev.map(req => ({ ...req, met: req.test(passwordDebounce.debouncedValue) }))
    );
  }, [passwordDebounce.debouncedValue, passwordDebounce.shouldShowValidation, type]);

  // Confirm password validation with debouncing
  useEffect(() => {
    if (type === 'login' || !confirmPasswordDebounce.shouldShowValidation || !confirmPasswordDebounce.debouncedValue) {
      setConfirmPasswordValidation({ isValid: false, message: '', type: 'error' });
      return;
    }

    if (passwordDebounce.debouncedValue !== confirmPasswordDebounce.debouncedValue) {
      setConfirmPasswordValidation({ isValid: false, message: 'Passwords do not match', type: 'error' });
    } else if (confirmPasswordDebounce.debouncedValue.length > 0) {
      setConfirmPasswordValidation({ isValid: true, message: 'Passwords match', type: 'success' });
    }
  }, [passwordDebounce.debouncedValue, confirmPasswordDebounce.debouncedValue, confirmPasswordDebounce.shouldShowValidation, type]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const isFormValid = () => {
    if (type === 'login') {
      return emailValidation.isValid && formData.password.length > 0;
    }

    return (
      emailValidation.isValid &&
      usernameValidation.isValid &&
      passwordRequirements.every(req => req.met) &&
      confirmPasswordValidation.isValid
    );
  };

  const handleEmailVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const result = await signUp?.attemptEmailAddressVerification({
        code: verificationCode,
      });

      if (result?.status === 'complete' && setActiveSignUp) {
        await setActiveSignUp({ session: result.createdSessionId });
        navigate('/dashboard');
      } else {
        setError('Invalid verification code. Please try again.');
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setIsLoading(true);
    setError('');

    try {
      await signUp?.prepareEmailAddressVerification({ strategy: 'email_code' });
      setError(''); // Clear error to show success message
      // You could add a success message state here if needed
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Failed to resend verification email.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) return;

    setIsLoading(true);
    setError('');

    try {
      if (type === 'login') {
        const result = await signIn?.create({
          identifier: formData.email,
          password: formData.password,
        });

        if (result?.status === 'complete' && setActive) {
          await setActive({ session: result.createdSessionId });
          navigate('/dashboard');
        }
      } else {
        const result = await signUp?.create({
          emailAddress: formData.email,
          username: formData.username,
          password: formData.password,
        });

        if (result?.status === 'complete' && setActiveSignUp) {
          await setActiveSignUp({ session: result.createdSessionId });
          navigate('/dashboard');
        } else if (result?.status === 'missing_requirements') {
          // Handle email verification step
          setVerificationStep('email-verification');
          setError(''); // Clear any previous errors
        }
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const ValidationMessage: React.FC<{
    validation: ValidationState;
    show: boolean;
    isTyping?: boolean;
  }> = ({ validation, show, isTyping }) => (
    <div className="mt-1 min-h-[24px]"> {/* Fixed height container to prevent jiggling */}
      <AnimatePresence mode="wait">
        {show && (
          <motion.div
            key={isTyping ? 'typing' : 'validation'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2 text-sm"
          >
            {isTyping ? (
              <>
                <div className="flex gap-1">
                  <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                  <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                  <div className="w-1 h-1 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-gray-500">Checking...</span>
              </>
            ) : validation.message ? (
              <>
                {validation.type === 'checking' || validation.isChecking ? (
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                ) : validation.type === 'success' ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                )}
                <span className={`${validation.type === 'checking' || validation.isChecking ? 'text-blue-600' :
                  validation.type === 'success' ? 'text-green-600' :
                    validation.type === 'warning' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                  {validation.message}
                </span>
              </>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const PasswordRequirements: React.FC = () => {
    const shouldShow = type === 'register' && passwordDebounce.hasUserInteracted;

    return (
      <div className={`mt-3 transition-all duration-200 ${shouldShow ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Password Requirements:</p>
          <div className="space-y-1">
            {passwordRequirements.map((req) => (
              <div key={req.id} className={`flex items-center gap-2 text-sm transition-colors duration-200 ${req.met ? 'text-green-600' : 'text-gray-500'}`}>
                <div className="w-3 h-3 flex items-center justify-center">
                  {req.met ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                </div>
                {req.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Email verification step
  if (verificationStep === 'email-verification') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Check your email
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            We've sent a verification code to <strong>{formData.email}</strong>
          </p>
        </div>

        <form onSubmit={handleEmailVerification} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Verification Code
            </label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-center text-lg tracking-widest"
              placeholder="Enter 6-digit code"
              maxLength={6}
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={!verificationCode.trim() || isLoading}
            className={`w-full py-3 px-6 rounded-xl font-semibold text-white transition-all duration-200 ${verificationCode.trim() && !isLoading
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transform hover:scale-[1.02] shadow-lg hover:shadow-xl'
              : 'bg-gray-400 cursor-not-allowed'
              }`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Verifying...
              </div>
            ) : (
              'Verify Email'
            )}
          </button>

          <div className="text-center space-y-3">
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={isLoading}
              className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              Didn't receive the code? Resend email
            </button>

            <button
              type="button"
              onClick={() => {
                setVerificationStep('form');
                setVerificationCode('');
                setError('');
              }}
              className="block text-sm text-blue-600 hover:text-blue-500 transition-colors mx-auto"
            >
              ← Back to sign up
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
      {/* Email Field */}
      <div>
        <label className="block text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 md:mb-2">
          Email Address
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-gray-400" />
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className={`w-full pl-9 md:pl-10 pr-4 py-2.5 md:py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm md:text-base ${formData.email && !emailValidation.isValid ? 'border-red-300' :
              emailValidation.isValid ? 'border-green-300' : 'border-gray-300'
              } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
            placeholder="Enter your email address"
            required
          />
        </div>
        <ValidationMessage
          validation={emailValidation}
          show={emailDebounce.hasUserInteracted}
          isTyping={emailDebounce.isTyping}
        />
      </div>

      {/* Username Field (Register only) */}
      {type === 'register' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Username
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${usernameValidation.isChecking || usernameValidation.type === 'checking' ? 'border-blue-300' :
                formData.username && !usernameValidation.isValid ? 'border-red-300' :
                  usernameValidation.isValid ? 'border-green-300' : 'border-gray-300'
                } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
              placeholder="Choose a username (min 5 characters)"
              required
            />
          </div>
          <ValidationMessage
            validation={usernameValidation}
            show={usernameDebounce.hasUserInteracted}
            isTyping={usernameDebounce.isTyping}
          />

          {/* Username Suggestions */}
          <div className={`mt-2 transition-all duration-200 ${usernameValidation.suggestions && usernameValidation.suggestions.length > 0 && usernameDebounce.shouldShowValidation
            ? 'opacity-100 max-h-32'
            : 'opacity-0 max-h-0 overflow-hidden'
            }`}>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300 mb-2">
                <Lightbulb className="w-4 h-4" />
                <span className="font-medium">Suggestions:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {usernameValidation.suggestions?.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleInputChange('username', suggestion)}
                    className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password Field */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={(e) => handleInputChange('password', e.target.value)}
            className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            placeholder={type === 'login' ? 'Enter your password' : 'Create a strong password'}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        <PasswordRequirements />
      </div>

      {/* Confirm Password Field (Register only) */}
      {type === 'register' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              className={`w-full pl-10 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${formData.confirmPassword && !confirmPasswordValidation.isValid ? 'border-red-300' :
                confirmPasswordValidation.isValid ? 'border-green-300' : 'border-gray-300'
                } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
              placeholder="Confirm your password"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <ValidationMessage
            validation={confirmPasswordValidation}
            show={confirmPasswordDebounce.hasUserInteracted}
            isTyping={confirmPasswordDebounce.isTyping}
          />
        </div>
      )}

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          >
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!isFormValid() || isLoading}
        className={`w-full py-2.5 md:py-3 px-4 md:px-6 rounded-xl font-semibold text-white transition-all duration-200 text-sm md:text-base ${isFormValid() && !isLoading
          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transform hover:scale-[1.02] shadow-lg hover:shadow-xl'
          : 'bg-gray-400 cursor-not-allowed'
          }`}
      >
        {isLoading ? (
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="text-sm md:text-base">
              {type === 'login' ? 'Signing In...' : 'Creating Account...'}
            </span>
          </div>
        ) : (
          <span className="text-sm md:text-base">
            {type === 'login' ? 'Sign In' : 'Create Account'}
          </span>
        )}
      </button>

      {/* OAuth functionality removed - clean email/password authentication only */}
    </form>
  );
};
