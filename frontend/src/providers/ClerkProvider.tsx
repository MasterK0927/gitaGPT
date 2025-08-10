import React from 'react';
import { ClerkProvider as BaseClerkProvider, ClerkLoaded, ClerkLoading } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  console.warn('Missing Clerk Publishable Key. Using mock authentication.');
  console.warn('Available env vars:', Object.keys(import.meta.env).filter(key => key.includes('CLERK')));
}

interface ClerkProviderProps {
  children: React.ReactNode;
}

// Inner component that has access to useNavigate
const ClerkProviderWithRouter: React.FC<ClerkProviderProps> = ({ children }) => {
  const { theme } = useTheme();
  const navigate = useNavigate();

  return (
    <BaseClerkProvider
      publishableKey={clerkPubKey}
      appearance={{
        baseTheme: undefined, // We'll handle dark mode with CSS variables
        variables: {
          colorPrimary: '#3b82f6',
          colorBackground: theme === 'dark' ? '#0f172a' : '#ffffff',
          colorInputBackground: theme === 'dark' ? '#1e293b' : '#f8fafc',
          colorInputText: theme === 'dark' ? '#f1f5f9' : '#0f172a',
        },
        elements: {
          formButtonPrimary:
            'bg-primary hover:bg-primary/90 text-primary-foreground',
          card: 'bg-background border border-border shadow-lg',
          headerTitle: 'text-foreground',
          headerSubtitle: 'text-muted-foreground',
          socialButtonsBlockButton:
            'bg-background border border-border hover:bg-accent text-foreground',
          formFieldLabel: 'text-foreground',
          formFieldInput:
            'bg-background border border-border text-foreground focus:border-primary',
          footerActionLink: 'text-primary hover:text-primary/90',
        },
      }}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      signInUrl="/login"
      signUpUrl="/register"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      <ClerkLoading>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </ClerkLoading>
      <ClerkLoaded>
        {children}
      </ClerkLoaded>
    </BaseClerkProvider>
  );
};

// Mock Clerk context for when key is missing
const MockClerkContext = React.createContext({
  user: null,
  isLoaded: true,
  isSignedIn: false,
  getToken: () => Promise.resolve(null),
});

const MockClerkProvider: React.FC<ClerkProviderProps> = ({ children }) => {
  return (
    <MockClerkContext.Provider value={{
      user: null,
      isLoaded: true,
      isSignedIn: false,
      getToken: () => Promise.resolve(null),
    }}>
      {children}
    </MockClerkContext.Provider>
  );
};

// Outer component that handles the case where Clerk key is missing
export const ClerkProvider: React.FC<ClerkProviderProps> = ({ children }) => {
  // If no Clerk key is provided, use mock provider
  if (!clerkPubKey) {
    console.warn('Using mock Clerk provider - authentication features will be limited');
    return <MockClerkProvider>{children}</MockClerkProvider>;
  }

  return <ClerkProviderWithRouter>{children}</ClerkProviderWithRouter>;
};
