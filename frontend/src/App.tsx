import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// Import responsive chat styles
import './styles/chat-responsive.css';

// Layouts
import { AuthLayout } from './layouts/AuthLayout';
import { DashboardLayout } from './layouts/DashboardLayout';

// Pages
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ChatPage } from './pages/ChatPage';
import { DashboardPage } from './pages/DashboardPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';

import { MeditationPage } from './pages/MeditationPage';


// Components
import { ProtectedRoute } from './features/auth/components';
import { ClerkProvider } from './providers/ClerkProvider';
import { UserSyncProvider } from './providers/UserSyncProvider';
import { SessionTimeoutProvider } from './providers/SessionTimeoutProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SystemStatus } from './components/system/SystemStatus';
import { AuthRedirectHandler } from './components/auth/AuthRedirectHandler';

// Constants
import { ROUTES } from './shared/constants';





const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.3 }}
  >
    {children}
  </motion.div>
);

function App() {
  // Note: Cache warming is now handled after user authentication
  // in the ModernChatInterface component to avoid 401 errors

  return (
    <ErrorBoundary>
      <Router
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ClerkProvider>
          <UserSyncProvider>
            <SessionTimeoutProvider>
              <AuthRedirectHandler>
                <div className="min-h-screen bg-background text-foreground">
                  <AnimatePresence mode="wait">
                    <Routes>
                      {/* Public Routes */}
                      <Route path="/" element={<Navigate to={ROUTES.DASHBOARD} replace />} />

                      {/* Auth Routes */}
                      <Route element={<AuthLayout />}>
                        <Route
                          path={ROUTES.LOGIN}
                          element={
                            <ProtectedRoute requireAuth={false}>
                              <PageTransition>
                                <LoginPage />
                              </PageTransition>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path={ROUTES.REGISTER}
                          element={
                            <ProtectedRoute requireAuth={false}>
                              <PageTransition>
                                <RegisterPage />
                              </PageTransition>
                            </ProtectedRoute>
                          }
                        />
                      </Route>

                      {/* Protected Dashboard Routes */}
                      <Route
                        element={
                          <ProtectedRoute>
                            <DashboardLayout />
                          </ProtectedRoute>
                        }
                      >
                        <Route
                          path={ROUTES.DASHBOARD}
                          element={
                            <PageTransition>
                              <DashboardPage />
                            </PageTransition>
                          }
                        />
                        <Route
                          path={ROUTES.CHAT}
                          element={
                            <PageTransition>
                              <ChatPage />
                            </PageTransition>
                          }
                        />
                        <Route
                          path={ROUTES.ANALYTICS}
                          element={
                            <PageTransition>
                              <AnalyticsPage />
                            </PageTransition>
                          }
                        />
                        <Route
                          path={ROUTES.SETTINGS}
                          element={
                            <PageTransition>
                              <SettingsPage />
                            </PageTransition>
                          }
                        />

                        <Route
                          path={ROUTES.MEDITATION}
                          element={
                            <PageTransition>
                              <MeditationPage />
                            </PageTransition>
                          }
                        />
                      </Route>



                      {/* Catch all route */}
                      <Route
                        path="*"
                        element={
                          <div className="min-h-screen flex items-center justify-center">
                            <div className="text-center space-y-4">
                              <h1 className="text-4xl font-bold text-muted-foreground">404</h1>
                              <p className="text-muted-foreground">Page not found</p>
                              <button
                                onClick={() => window.history.back()}
                                className="text-primary hover:underline"
                              >
                                Go back
                              </button>
                            </div>
                          </div>
                        }
                      />
                    </Routes>
                  </AnimatePresence>

                  {/* System Status - Inside ClerkProvider */}
                  <SystemStatus />
                </div>
              </AuthRedirectHandler>
            </SessionTimeoutProvider>
          </UserSyncProvider>
        </ClerkProvider>
      </Router>

      {/* Global Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'hsl(var(--background))',
            color: 'hsl(var(--foreground))',
            border: '1px solid hsl(var(--border))',
          },
        }}
      />

    </ErrorBoundary>
  );
}

export default App;
