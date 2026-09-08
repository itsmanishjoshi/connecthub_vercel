import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/SimpleAuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoginScreen } from "./components/Auth/LoginScreen";
import { SetPasswordScreen } from "./components/Auth/SetPasswordScreen";
import { OnboardingFlow } from "./components/Onboarding/OnboardingFlow";
import { LoadingScreen } from "./components/LoadingScreen";
import { useState, useEffect } from "react";
import { JellyChatbot } from "./components/JellyChatbot";
import { JellyIcon } from "./components/JellyIcon";
import { JELLY_OPEN_EVENT } from "./lib/jellyEvents";
import Landing from "./pages/Landing";
import EventPage from "./pages/EventPage";
import NotFound from "./pages/NotFound";
import SettingsPage from "./pages/SettingsPage";
import NotesPage from "./pages/NotesPage";
import AdminPanel from "./pages/AdminPanel";
import AdminUserDataPage from "./pages/AdminUserDataPage";
import { SyncIndicator } from "./components/SyncIndicator";
import { UpdatePrompt } from "./components/UpdatePrompt";
const queryClient = new QueryClient();

function AppContent() {
  const { mode, signIn, profile, isAdmin, mustChangePassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jellyOpen, setJellyOpen] = useState(false);

  const handleSignIn = async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      await signIn(username, password);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const openJelly = () => setJellyOpen(true);
    window.addEventListener(JELLY_OPEN_EVENT, openJelly);
    return () => window.removeEventListener(JELLY_OPEN_EVENT, openJelly);
  }, []);

  // Show loading screen while checking auth
  if (mode === 'checking') {
    return <LoadingScreen />;
  }

  // Show login screen if not authenticated
  if (mode === 'needsAuth') {
    return (
      <LoginScreen
        onSignIn={handleSignIn}
        loading={loading}
        error={error}
      />
    );
  }

  if (!isAdmin && mustChangePassword) {
    return <SetPasswordScreen />;
  }

  // Check if user needs to complete onboarding
  // Admin users skip onboarding and go directly to landing page
  // Only show onboarding for non-admin users if profile exists but is not completed
  if (profile && !profile.profileCompleted && !profile.isAdmin) {
    return <OnboardingFlow />;
  }

  // User is authenticated and profile is complete - show main app
  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/my-accion" element={<Landing />} />
        <Route path="/events" element={<Landing />} />
        <Route path="/galaxy" element={<Landing />} />
        <Route path="/repository" element={<Landing />} />
        <Route path="/assets" element={<Landing />} />
        <Route path="/analytics" element={<Landing />} />
        <Route path="/login" element={<Landing />} /> {/* Redirect login to home */}
        <Route path="/profile/edit" element={<Navigate to="/settings" replace />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/qr-code" element={<Navigate to="/settings" replace />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/users/:userId/data" element={<AdminUserDataPage />} />
        <Route path="/connect-hub/hub" element={<EventPage />} />
        <Route path="/connect-hub/hr-meet" element={<EventPage />} />
        <Route path="/connect-hub/mainstream" element={<EventPage />} />
        <Route path="/connect-hub/:slug" element={<EventPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <SyncIndicator />
      <UpdatePrompt />

      <JellyChatbot open={jellyOpen} onClose={() => setJellyOpen(false)} />

      <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-3 z-50 flex flex-col items-end gap-3 sm:right-6">
        {!jellyOpen && (
          <button
            type="button"
            onClick={() => setJellyOpen(true)}
            className="jelly-fab"
            aria-label="Open Jelly assistant"
          >
            <JellyIcon className="h-10 w-auto sm:h-12" />
          </button>
        )}
      </div>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary level="app">
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <BrowserRouter>
            <AuthProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <AppContent />
              </TooltipProvider>
            </AuthProvider>
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
