import { useState, useEffect } from 'react';

/**
 * Custom hook that debounces a value
 * @param value - The value to debounce
 * @param delay - The delay in milliseconds
 * @returns The debounced value
 */
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up a timer to update the debounced value after the delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up the timer if the value changes before the delay
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Custom hook for debounced validation with immediate feedback for empty values
 * @param value - The value to validate
 * @param delay - The delay in milliseconds (default: 500ms)
 * @returns Object with current value, debounced value, and validation state
 */
export const useDebouncedValidation = (value: string, delay: number = 500) => {
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const debouncedValue = useDebounce(value, delay);

  useEffect(() => {
    if (value.length > 0 && !hasUserInteracted) {
      setHasUserInteracted(true);
    }
  }, [value, hasUserInteracted]);

  useEffect(() => {
    if (hasUserInteracted) {
      setIsTyping(true);
      const timer = setTimeout(() => {
        setIsTyping(false);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [value, delay, hasUserInteracted]);

  return {
    currentValue: value,
    debouncedValue,
    shouldShowValidation: hasUserInteracted && (value.length === 0 || debouncedValue === value),
    hasUserInteracted,
    isTyping: isTyping && value !== debouncedValue
  };
};
