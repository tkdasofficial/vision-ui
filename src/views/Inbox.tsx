import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Inbox as InboxIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ProfileMenu from "@/components/ProfileMenu";

type Notification = {
  id: string;
  title: string;
  message: string;
  target: string;
  created_at: string;
};

const Inbox = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("admin_notifications")
        .select("*")
        .order("created_at", { ascending: false });
      setNotifications((data as Notification[]) || []);
      setLoading(false);
    };
    load();

    // Realtime subscription
    const channel = supabase
      .channel("inbox-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_notifications" }, (payload) => {
        setNotifications((prev) => [payload.new as Notification, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-display font-semibold text-foreground">Inbox</h1>
        <ProfileMenu />
      </header>

      <div className="flex-1 px-4 py-6 sm:px-6 overflow-y-auto">
        <div className="max-w-lg mx-auto space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-5 h-5 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <InboxIcon className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">No messages yet</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className="rounded-xl border border-border bg-card p-4 space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bell className="w-4 h-4 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">{timeAgo(n.created_at)}</span>
                </div>
                <p className="text-sm text-muted-foreground pl-[42px]">{n.message}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Inbox;
