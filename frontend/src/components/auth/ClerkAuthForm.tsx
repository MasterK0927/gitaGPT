import React from 'react';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { motion } from 'framer-motion';

interface ClerkAuthFormProps {
  type: 'login' | 'register';
}

export const ClerkAuthForm: React.FC<ClerkAuthFormProps> = ({ type }) => {
  const commonAppearance = {
    elements: {
      rootBox: "w-full",
      card: "bg-background/95 backdrop-blur-sm border border-border/50 shadow-2xl rounded-2xl overflow-hidden",

      // Header styling
      headerTitle: "text-2xl font-bold text-foreground mb-2",
      headerSubtitle: "text-muted-foreground text-base",

      // Form styling
      formButtonPrimary: `
        bg-gradient-to-r from-blue-600 to-indigo-600 
        hover:from-blue-700 hover:to-indigo-700 
        text-white font-semibold py-3 px-6 rounded-xl 
        transition-all duration-200 transform hover:scale-[1.02] 
        shadow-lg hover:shadow-xl
        border-0 text-base
      `,

      formButtonSecondary: `
        bg-background border border-border 
        hover:bg-accent text-foreground 
        font-medium py-3 px-6 rounded-xl 
        transition-all duration-200
        text-base
      `,

      // Social buttons
      socialButtonsBlockButton: `
        bg-background border border-border 
        hover:bg-accent hover:border-border/80 
        text-foreground font-medium py-3 px-6 rounded-xl 
        transition-all duration-200 transform hover:scale-[1.01]
        text-base flex items-center justify-center gap-3
        shadow-sm hover:shadow-md
      `,

      socialButtonsBlockButtonText: "font-medium",

      // Input styling
      formFieldInput: `
        bg-background/50 border border-border/50 
        text-foreground placeholder:text-muted-foreground 
        focus:border-primary focus:ring-2 focus:ring-primary/20 
        rounded-xl py-3 px-4 text-base
        transition-all duration-200
        backdrop-blur-sm
      `,

      formFieldLabel: "text-foreground font-medium text-sm mb-2",

      // Links and text
      footerActionLink: `
        text-primary hover:text-primary/80 
        font-medium transition-colors duration-200
        text-base
      `,

      identityPreviewText: "text-foreground",
      identityPreviewEditButton: "text-primary hover:text-primary/80 transition-colors",

      // Divider
      dividerLine: "bg-border/50",
      dividerText: "text-muted-foreground text-sm font-medium",

      // Form container
      form: "space-y-6",
      formFieldRow: "space-y-2",

      // Footer
      footer: "mt-8 pt-6 border-t border-border/50",

      // Loading states
      spinner: "text-primary",

      // Error states
      formFieldErrorText: "text-red-500 text-sm mt-1",

      // Success states
      formFieldSuccessText: "text-green-500 text-sm mt-1",

      // Modal overlay (if used)
      modalBackdrop: "bg-black/50 backdrop-blur-sm",
      modalContent: "bg-background border border-border rounded-2xl shadow-2xl",
    },

    variables: {
      colorPrimary: '#3b82f6',
      colorBackground: 'hsl(var(--background))',
      colorInputBackground: 'hsl(var(--background))',
      colorInputText: 'hsl(var(--foreground))',
      colorText: 'hsl(var(--foreground))',
      colorTextSecondary: 'hsl(var(--muted-foreground))',
      colorNeutral: 'hsl(var(--muted))',
      colorShimmer: 'hsl(var(--muted))',
      fontFamily: 'inherit',
      fontSize: '16px',
      borderRadius: '12px',
      spacingUnit: '1rem',
    },

    layout: {
      socialButtonsPlacement: 'top' as const,
      socialButtonsVariant: 'blockButton' as const,
      showOptionalFields: true,
    }
  };

  if (type === 'login') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full"
      >
        <SignIn
          appearance={commonAppearance}
          signUpUrl="/register"
          forceRedirectUrl="/dashboard"
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      <SignUp
        appearance={commonAppearance}
        signInUrl="/login"
        forceRedirectUrl="/dashboard"
      />
    </motion.div>
  );
};
