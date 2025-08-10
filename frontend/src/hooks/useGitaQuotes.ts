import { useState, useEffect } from 'react';
import axios from 'axios';

interface GitaQuote {
  id: number;
  verse: string;
  sanskrit: string;
  english: string;
  meaning: string;
  category: string;
  tags: string[];
}

interface UseGitaQuotesReturn {
  quote: GitaQuote | null;
  loading: boolean;
  error: string | null;
  refreshQuote: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const useGitaQuotes = (autoRefresh: boolean = false, refreshInterval: number = 60000): UseGitaQuotesReturn => {
  const [quote, setQuote] = useState<GitaQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRandomQuote = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`${API_BASE_URL}/api/v1/gita/quotes/random`);
      
      if (response.data.success) {
        setQuote(response.data.data.quote);
      } else {
        setError('Failed to fetch quote');
      }
    } catch (err) {
      console.error('Error fetching Gita quote:', err);
      setError('Failed to fetch quote');
    } finally {
      setLoading(false);
    }
  };

  const refreshQuote = () => {
    fetchRandomQuote();
  };

  useEffect(() => {
    // Initial fetch
    fetchRandomQuote();

    // Set up auto-refresh if enabled
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(fetchRandomQuote, refreshInterval);
    }

    // Cleanup
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [autoRefresh, refreshInterval]);

  return {
    quote,
    loading,
    error,
    refreshQuote
  };
};

// Hook for searching quotes
export const useGitaQuoteSearch = () => {
  const [quotes, setQuotes] = useState<GitaQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchQuotes = async (query: string) => {
    if (!query.trim()) {
      setQuotes([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`${API_BASE_URL}/api/v1/gita/quotes/search`, {
        params: { q: query }
      });
      
      if (response.data.success) {
        setQuotes(response.data.data.quotes);
      } else {
        setError('Failed to search quotes');
      }
    } catch (err) {
      console.error('Error searching Gita quotes:', err);
      setError('Failed to search quotes');
    } finally {
      setLoading(false);
    }
  };

  return {
    quotes,
    loading,
    error,
    searchQuotes
  };
};

// Hook for getting quotes by category
export const useGitaQuotesByCategory = (category: string) => {
  const [quotes, setQuotes] = useState<GitaQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuotesByCategory = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await axios.get(`${API_BASE_URL}/api/v1/gita/categories/${encodeURIComponent(category)}`);
        
        if (response.data.success) {
          setQuotes(response.data.data.quotes);
        } else {
          setError('Failed to fetch quotes');
        }
      } catch (err) {
        console.error('Error fetching quotes by category:', err);
        setError('Failed to fetch quotes');
      } finally {
        setLoading(false);
      }
    };

    if (category) {
      fetchQuotesByCategory();
    }
  }, [category]);

  return {
    quotes,
    loading,
    error
  };
};
