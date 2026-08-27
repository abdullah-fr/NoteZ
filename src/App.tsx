import '@/lib/i18n';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { TimerProvider } from "@/lib/timer";
import { CalendarProvider } from "@/lib/calendar";
import { CreditsProvider } from "@/contexts/CreditsContext";
import LimitModal from "@/components/credits/LimitModal";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useEffect } from "react";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Pricing from "./pages/Pricing";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Apply persisted theme on every cold load before first paint
function ThemeInitializer() {
  useEffect(() => {
    const stored = localStorage.getItem('notez_theme');
    document.documentElement.setAttribute(
      'data-theme',
      stored === 'midnight' ? 'midnight' : 'warm-paper',
    );
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <ThemeInitializer />
      <AuthProvider>
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
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
