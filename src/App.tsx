import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ChatHistoryProvider } from "@/context/ChatHistoryContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Index from "./pages/Index";
import Account from "./pages/Account";
import Settings from "./pages/Settings";
import Upgrade from "./pages/Upgrade";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Support from "./pages/Support";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Inbox from "./pages/Inbox";
import Integrations from "./pages/Integrations";
import Prospecting from "./pages/Prospecting";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminSubscriptions from "./pages/admin/Subscriptions";
import AdminReports from "./pages/admin/Reports";
import AdminNotifications from "./pages/admin/Notifications";
import AdminChatSessions from "./pages/admin/ChatSessions";
import AdminBackgroundTasks from "./pages/admin/BackgroundTasks";
import AdminAnalytics from "./pages/admin/Analytics";
import AdminSystemSettings from "./pages/admin/SystemSettings";
import AdminSupport from "./pages/admin/Support";
import AdminAnnouncements from "./pages/admin/Announcements";
import AdminFeatureFlags from "./pages/admin/FeatureFlags";
import AdminAuditLog from "./pages/admin/AuditLog";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-[100dvh] bg-background flex items-center justify-center"><div className="w-6 h-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <ChatHistoryProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Auth */}
              <Route path="/login" element={<Auth />} />
              <Route path="/signup" element={<Auth />} />
              <Route path="/forgot-password" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Legacy redirect */}
              <Route path="/auth" element={<Navigate to="/login" replace />} />

              {/* Docs (public) */}
              <Route path="/docs/terms-conditions" element={<Terms />} />
              <Route path="/docs/privacy-policy" element={<Privacy />} />

              {/* App routes */}
              <Route path="/" element={<Navigate to="/app/new" replace />} />
              <Route path="/app/new" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/app/chat/:chatId" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/app/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
              <Route path="/app/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/app/upgrade" element={<ProtectedRoute><Upgrade /></ProtectedRoute>} />
              <Route path="/app/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
              <Route path="/app/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
              <Route path="/app/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
              <Route path="/app/prospecting" element={<ProtectedRoute><Prospecting /></ProtectedRoute>} />

              {/* Admin */}
              <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="subscriptions" element={<AdminSubscriptions />} />
                <Route path="chat-sessions" element={<AdminChatSessions />} />
                <Route path="background-tasks" element={<AdminBackgroundTasks />} />
                <Route path="analytics" element={<AdminAnalytics />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="notifications" element={<AdminNotifications />} />
                <Route path="system" element={<AdminSystemSettings />} />
                <Route path="support" element={<AdminSupport />} />
                <Route path="announcements" element={<AdminAnnouncements />} />
                <Route path="feature-flags" element={<AdminFeatureFlags />} />
                <Route path="audit" element={<AdminAuditLog />} />

              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ChatHistoryProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
