import { useNavigate } from "react-router-dom";
import { ArrowLeft, Globe, Bell, BellOff, Trash2, Download, AlertTriangle, Loader2, Check, BellRing } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import ProfileMenu from "@/components/ProfileMenu";

type UserSettings = {
  language: string;
  notifications_enabled: boolean;
  default_tool: string;
};

const Settings = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  const [language, setLanguage] = useState("English");
  const [notifications, setNotifications] = useState(true);
  const [defaultTool, setDefaultTool] = useState("Main Chat");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");

  // Check push notification permission
  useEffect(() => {
    if ("Notification" in window) {
      setPushPermission(Notification.permission);
    }
  }, []);

  // Load settings from DB
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("user_settings")
        .select("language, notifications_enabled, default_tool")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setLanguage(data.language);
        setNotifications(data.notifications_enabled);
        setDefaultTool(data.default_tool);
      } else {
        // Create settings row for existing users
        await supabase.from("user_settings").insert({ user_id: user.id });
      }
      setLoading(false);
    };
    load();
  }, [user]);

  // Save a setting to DB
  const saveSetting = useCallback(async (updates: Partial<UserSettings>) => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("user_settings")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Error", description: "Failed to save setting.", variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Setting updated successfully." });
    }
    setSaving(false);
  }, [user, toast]);

  // Handle language change
  const handleLanguageChange = (val: string) => {
    setLanguage(val);
    saveSetting({ language: val });
  };

  // Handle default tool change
  const handleDefaultToolChange = (val: string) => {
    setDefaultTool(val);
    saveSetting({ default_tool: val });
  };

  // Handle notifications toggle
  const handleNotificationsToggle = async () => {
    const newValue = !notifications;
    setNotifications(newValue);
    saveSetting({ notifications_enabled: newValue });
  };

  // Request push notification permission
  const handleRequestPush = async () => {
    if (!("Notification" in window)) {
      toast({ title: "Not Supported", description: "Push notifications are not supported in this browser.", variant: "destructive" });
      return;
    }

    const permission = await Notification.requestPermission();
    setPushPermission(permission);

    if (permission === "granted") {
      toast({ title: "Notifications Enabled", description: "You'll receive push notifications." });
      // Show a test notification
      new Notification("SuperCopilot", {
        body: "Push notifications are now enabled! 🎉",
        icon: "/og-icon.png",
      });
      if (!notifications) {
        setNotifications(true);
        saveSetting({ notifications_enabled: true });
      }
    } else if (permission === "denied") {
      toast({ title: "Blocked", description: "Notifications were blocked. Enable them in your browser settings.", variant: "destructive" });
    }
  };

  // Export data
  const handleExport = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const { data: sessions } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const { data: messages } = await supabase
        .from("chat_messages")
        .select("*")
        .in("session_id", (sessions || []).map(s => s.id));

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      const exportData = {
        exportedAt: new Date().toISOString(),
        profile,
        sessions: (sessions || []).map(session => ({
          ...session,
          messages: (messages || []).filter(m => m.session_id === session.id),
        })),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `supercopilot-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Exported", description: "Your data has been downloaded." });
    } catch {
      toast({ title: "Error", description: "Failed to export data.", variant: "destructive" });
    }
    setExporting(false);
  };

  // Clear all chat history
  const handleClearHistory = async () => {
    if (!user) return;
    setClearing(true);
    try {
      const { error } = await supabase
        .from("chat_sessions")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;
      toast({ title: "Cleared", description: "All chat history has been deleted." });
    } catch {
      toast({ title: "Error", description: "Failed to clear history.", variant: "destructive" });
    }
    setClearing(false);
  };

  // Delete account
  const handleDeleteAccount = async () => {
    if (!user) return;
    try {
      // Delete user data (cascades will handle related tables)
      await supabase.from("chat_sessions").delete().eq("user_id", user.id);
      await supabase.from("user_settings").delete().eq("user_id", user.id);
      await signOut();
      toast({ title: "Account deleted", description: "Your data has been removed." });
      navigate("/login");
    } catch {
      toast({ title: "Error", description: "Failed to delete account.", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-display font-semibold text-foreground">Settings</h1>
        <ProfileMenu />
      </header>

      <div className="flex-1 px-4 py-6 sm:px-6 overflow-y-auto">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Saving indicator */}
          {saving && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Saving...</span>
            </div>
          )}

          {/* Preferences */}
          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-4">Preferences</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Language</p>
                    <p className="text-xs text-muted-foreground">Interface language</p>
                  </div>
                </div>
                <select
                  value={language}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="bg-accent text-foreground text-xs rounded-lg px-3 py-1.5 border-none outline-none cursor-pointer"
                >
                  <option>English</option>
                  <option>Spanish</option>
                  <option>French</option>
                  <option>Hindi</option>
                  <option>Arabic</option>
                </select>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  {notifications ? <Bell className="w-4 h-4 text-muted-foreground" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
                  <div>
                    <p className="text-sm font-medium text-foreground">Notifications</p>
                    <p className="text-xs text-muted-foreground">Enable or disable alerts</p>
                  </div>
                </div>
                <button
                  onClick={handleNotificationsToggle}
                  className={`w-10 h-6 rounded-full transition-colors relative ${notifications ? "bg-foreground" : "bg-muted"}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-background absolute top-1 transition-all ${notifications ? "left-5" : "left-1"}`} />
                </button>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Default tool</p>
                  <p className="text-xs text-muted-foreground">Opens on launch</p>
                </div>
                <select
                  value={defaultTool}
                  onChange={(e) => handleDefaultToolChange(e.target.value)}
                  className="bg-accent text-foreground text-xs rounded-lg px-3 py-1.5 border-none outline-none cursor-pointer"
                >
                  <option>Main Chat</option>
                  <option>Developer</option>
                  <option>Designer</option>
                  <option>Video</option>
                  <option>Agent</option>
                </select>
              </div>
            </div>
          </section>

          {/* Push Notifications */}
          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-4">Push Notifications</h2>
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <BellRing className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Browser Push Notifications</p>
                      <p className="text-xs text-muted-foreground">
                        {pushPermission === "granted"
                          ? "Push notifications are enabled"
                          : pushPermission === "denied"
                          ? "Blocked — update in browser settings"
                          : "Allow browser notifications"}
                      </p>
                    </div>
                  </div>
                  {pushPermission === "granted" ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Check className="w-4 h-4 text-[hsl(var(--success))]" />
                      <span className="text-[hsl(var(--success))]">Enabled</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleRequestPush}
                      disabled={pushPermission === "denied"}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Enable
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Data & Privacy */}
          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-4">Data & Privacy</h2>
            <div className="space-y-3">
              <button
                onClick={handleExport}
                disabled={exporting}
                className="w-full flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-accent transition-colors text-left disabled:opacity-50"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Download className="w-4 h-4 text-muted-foreground" />}
                <div>
                  <p className="text-sm font-medium text-foreground">Export data</p>
                  <p className="text-xs text-muted-foreground">Download all your conversations & data as JSON</p>
                </div>
              </button>

              <button
                onClick={handleClearHistory}
                disabled={clearing}
                className="w-full flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-accent transition-colors text-left disabled:opacity-50"
              >
                {clearing ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Trash2 className="w-4 h-4 text-muted-foreground" />}
                <div>
                  <p className="text-sm font-medium text-foreground">Clear all history</p>
                  <p className="text-xs text-muted-foreground">Delete all saved conversations (kept for 7 days)</p>
                </div>
              </button>

              <button
                onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                className="w-full flex items-center gap-3 rounded-xl border border-destructive/30 bg-card p-4 hover:bg-destructive/5 transition-colors text-left"
              >
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <div>
                  <p className="text-sm font-medium text-destructive">Delete account</p>
                  <p className="text-xs text-muted-foreground">Permanently delete your account & data</p>
                </div>
              </button>

              {showDeleteConfirm && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 animate-fade-up">
                  <p className="text-sm text-foreground mb-3">Are you sure? This action cannot be undone.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-accent transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteAccount}
                      className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Settings;
