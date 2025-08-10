import { useState, useEffect, useCallback } from 'react';
import { apiServices } from '../lib/apiClient';

// Use production API client for all environments
const api = apiServices;

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}

interface UsernameValidationResult {
  isValid: boolean;
  message: string;
  type: 'success' | 'error' | 'warning' | 'checking';
  suggestions?: string[];
  isChecking?: boolean;
}

// Reserved usernames that should not be allowed
const RESERVED_USERNAMES = [
  'admin', 'administrator', 'root', 'user', 'guest', 'test', 'demo',
  'api', 'www', 'mail', 'email', 'support', 'help', 'info', 'contact',
  'about', 'terms', 'privacy', 'legal', 'security', 'login', 'register',
  'signup', 'signin', 'logout', 'profile', 'account', 'settings',
  'dashboard', 'home', 'index', 'main', 'public', 'static', 'assets',
  'krishna', 'gita', 'bhagavad', 'spiritual', 'guru', 'master',
  'null', 'undefined', 'true', 'false', 'system', 'config'
];

// Common profanity words (basic list - in production, use a comprehensive filter)
const PROFANITY_WORDS = [
  'damn', 'hell', 'stupid', 'idiot', 'hate', 'kill', 'death', 'violence'
];

export const useUsernameValidation = (username: string, email: string, shouldValidate: boolean = true) => {
  const [validation, setValidation] = useState<UsernameValidationResult>({
    isValid: false,
    message: '',
    type: 'error',
    isChecking: false
  });

  // Debounced availability check
  const checkAvailability = useCallback(async (usernameToCheck: string) => {
    try {
      setValidation(prev => ({ ...prev, isChecking: true, type: 'checking', message: 'Checking availability...' }));

      const response = await api.auth.checkUsername(usernameToCheck);

      if (response.data.success) {
        const { available, reason, message } = response.data;

        if (available) {
          setValidation({
            isValid: true,
            message: 'Username is available!',
            type: 'success',
            isChecking: false
          });
        } else {
          let errorMessage = message || 'Username is not available';
          let suggestions: string[] = [];

          // Get suggestions if username is taken
          if (reason === 'taken') {
            try {
              const suggestionsResponse = await api.auth.getUsernameSuggestions({
                base: usernameToCheck
              });
              if (suggestionsResponse.data.success) {
                suggestions = suggestionsResponse.data.suggestions;
                errorMessage += '. Here are some alternatives:';
              }
            } catch (error) {
              console.warn('Failed to get username suggestions:', error);
            }
          }

          setValidation({
            isValid: false,
            message: errorMessage,
            type: 'error',
            suggestions,
            isChecking: false
          });
        }
      } else {
        setValidation({
          isValid: false,
          message: 'Unable to check username availability',
          type: 'warning',
          isChecking: false
        });
      }
    } catch (error) {
      console.error('Username availability check failed:', error);
      setValidation({
        isValid: false,
        message: 'Unable to verify username availability',
        type: 'warning',
        isChecking: false
      });
    }
  }, []);

  // Debounce the availability check
  const debouncedCheck = useCallback(
    debounce((username: string) => checkAvailability(username), 500),
    [checkAvailability]
  );

  useEffect(() => {
    // Don't validate if we shouldn't or if username is empty
    if (!shouldValidate || !username.trim()) {
      setValidation({ isValid: false, message: '', type: 'error' });
      return;
    }

    // Ensure email is a string to prevent errors
    const safeEmail = email || '';

    const trimmedUsername = username.trim().toLowerCase();
    const emailPrefix = safeEmail && safeEmail.includes('@') ? safeEmail.split('@')[0].toLowerCase() : '';

    // Length validation
    if (username.length < 5) {
      setValidation({
        isValid: false,
        message: 'Username must be at least 5 characters long',
        type: 'error'
      });
      return;
    }

    if (username.length > 30) {
      setValidation({
        isValid: false,
        message: 'Username must be less than 30 characters',
        type: 'error'
      });
      return;
    }

    // Character validation
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setValidation({
        isValid: false,
        message: 'Username can only contain letters, numbers, hyphens, and underscores',
        type: 'error'
      });
      return;
    }

    // Cannot start or end with special characters
    if (/^[-_]|[-_]$/.test(username)) {
      setValidation({
        isValid: false,
        message: 'Username cannot start or end with hyphens or underscores',
        type: 'error'
      });
      return;
    }

    // Cannot have consecutive special characters
    if (/[-_]{2,}/.test(username)) {
      setValidation({
        isValid: false,
        message: 'Username cannot have consecutive hyphens or underscores',
        type: 'error'
      });
      return;
    }

    // Email similarity check (only if email is provided)
    if (safeEmail && (trimmedUsername === safeEmail.toLowerCase() || trimmedUsername === emailPrefix)) {
      const suggestions = generateUsernameSuggestions(emailPrefix || 'user');
      setValidation({
        isValid: false,
        message: 'Username cannot be the same as your email',
        type: 'error',
        suggestions
      });
      return;
    }

    // Reserved username check
    if (RESERVED_USERNAMES.includes(trimmedUsername)) {
      const suggestions = generateUsernameSuggestions(trimmedUsername);
      setValidation({
        isValid: false,
        message: 'This username is reserved. Please choose another one.',
        type: 'error',
        suggestions
      });
      return;
    }

    // Profanity check
    const containsProfanity = PROFANITY_WORDS.some(word => 
      trimmedUsername.includes(word.toLowerCase())
    );
    
    if (containsProfanity) {
      setValidation({
        isValid: false,
        message: 'Username contains inappropriate content. Please choose another one.',
        type: 'error'
      });
      return;
    }

    // Numbers only check
    if (/^\d+$/.test(username)) {
      setValidation({
        isValid: false,
        message: 'Username cannot contain only numbers',
        type: 'error'
      });
      return;
    }

    // Too many numbers warning
    const numberCount = (username.match(/\d/g) || []).length;
    const numberRatio = numberCount / username.length;
    
    if (numberRatio > 0.5) {
      setValidation({
        isValid: true,
        message: 'Username has many numbers. Consider using more letters for better readability.',
        type: 'warning'
      });
      return;
    }

    // All local validations passed, now check availability
    debouncedCheck(trimmedUsername);

  }, [username, shouldValidate, debouncedCheck]);

  return validation;
};

// Generate username suggestions
const generateUsernameSuggestions = (base: string): string[] => {
  const suggestions: string[] = [];
  const cleanBase = base.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  
  if (cleanBase.length >= 3) {
    // Add random numbers
    suggestions.push(`${cleanBase}${Math.floor(Math.random() * 999) + 1}`);
    suggestions.push(`${cleanBase}${Math.floor(Math.random() * 99) + 10}`);
    
    // Add prefixes/suffixes
    const prefixes = ['the', 'my', 'user'];
    const suffixes = ['user', 'seeker', 'soul', 'mind'];
    
    suggestions.push(`${prefixes[Math.floor(Math.random() * prefixes.length)]}${cleanBase}`);
    suggestions.push(`${cleanBase}${suffixes[Math.floor(Math.random() * suffixes.length)]}`);
    
    // Add year
    const currentYear = new Date().getFullYear();
    suggestions.push(`${cleanBase}${currentYear}`);
  }
  
  return suggestions.slice(0, 3); // Return max 3 suggestions
};
