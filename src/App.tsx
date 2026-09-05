import '@/lib/i18n';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { TimerProvider } from "@/lib/timer";
import { CalendarProvider } from "@/lib/calendar";
import { CreditsProvider } from "@/contexts/CreditsContext";
import LimitModal from "@/components/credits/LimitModal";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { clearLegacyUserStorage } from "@/lib/user-storage";
import { Fragment, useEffect, useMemo } from "react";
import { applyTheme } from "@/hooks/use-theme";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Pricing from "./pages/Pricing";
import About from "./pages/About";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Security from "./pages/Security";
import NotFound from "./pages/NotFound";

// Apply persisted theme on every cold load before first paint
function ThemeInitializer() {
  useEffect(() => {
    const stored = localStorage.getItem('notez_theme');
    applyTheme(stored === 'dark' || stored === 'midnight' ? 'dark' : 'light');
  }, []);
  return null;
}

function RouteScrollReset() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}

/**
 * Keep every user-aware provider and route tree scoped to the current account.
 * Changing the auth identity remounts their in-memory state and clears any
 * query cache before the next account's data is fetched.
 */
function UserScopedApp() {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  // Give each authenticated identity a fresh cache container. This prevents
  // a future useQuery from rendering the previous account's result while the
  // auth transition is settling; the provider is recreated synchronously from
  // the new identity rather than cleared one effect later.
  const queryClient = useMemo(() => new QueryClient(), [userId]);

  useEffect(() => {
    // Query caches are memory-only today, but clear each identity's cache as
    // soon as that identity is replaced so a future provider cannot retain a
    // previous account's result during an auth transition.
    return () => queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    if (loading) return;

    clearLegacyUserStorage();
  }, [loading]);

  return (
    <QueryClientProvider client={queryClient}>
      <Fragment key={userId ?? 'signed-out'}>
        <CreditsProvider>
          <TimerProvider>
            <CalendarProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <LimitModal />
                <RouteScrollReset />
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/security" element={<Security />} />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </TooltipProvider>
            </CalendarProvider>
          </TimerProvider>
        </CreditsProvider>
      </Fragment>
    </QueryClientProvider>
  );
}

const App = () => (
  <BrowserRouter>
    <ThemeInitializer />
    <AuthProvider>
      <UserScopedApp />
    </AuthProvider>
  </BrowserRouter>
);

export default App;
