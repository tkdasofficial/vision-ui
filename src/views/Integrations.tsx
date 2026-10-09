import { useEffect, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/backend/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, Mail, Youtube, Cloud, Calendar, Plug, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type OAuthIntegration = {
  id: string;
  name: string;
  provider: string;
  description: string;
  icon: any;
  color: string;
};

const OAUTH_INTEGRATIONS: OAuthIntegration[] = [
  { id: "gmail", name: "Gmail", provider: "gmail", description: "Send and read emails automatically from your inbox.", icon: Mail, color: "text-red-500" },
  { id: "youtube", name: "YouTube", provider: "youtube", description: "Auto-upload videos and manage your channel.", icon: Youtube, color: "text-red-600" },
  { id: "google_drive", name: "Google Drive", provider: "google_drive", description: "Read and save files to your Drive.", icon: Cloud, color: "text-yellow-500" },
  { id: "google_calendar", name: "Google Calendar", provider: "google_calendar", description: "Create events and read your schedule.", icon: Calendar, color: "text-blue-400" },
];

const Integrations = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState<Record<string, { id: string; label?: string | null }>>({});
  const [pending, setPending] = useState<string | null>(null);

  const loadOAuth = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_integrations")
      .select("id, provider, account_label, status")
      .eq("user_id", user.id);
    const map: Record<string, { id: string; label?: string | null }> = {};
    (data || []).forEach((r: any) => {
      if (r.status === "connected") map[r.provider] = { id: r.id, label: r.account_label };
    });
    setConnected(map);
    setLoading(false);
  };

  useEffect(() => { loadOAuth(); }, [user?.id]);

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.data?.type === "oauth-result") {
        if (ev.data.ok) toast.success("Account connected");
        else toast.error(`Connection failed: ${ev.data.provider ?? ""}`);
        loadOAuth();
        setPending(null);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleConnect = async (intg: OAuthIntegration) => {
    if (!user) return;
    setPending(intg.provider);
    const popup = window.open("about:blank", "oauth", "width=560,height=720");
    try {
      const { data, error } = await supabase.functions.invoke("oauth-initiate", { body: { provider: intg.provider } });
      if (error || !data?.authUrl) {
        popup?.close();
        setPending(null);
        toast.error(error?.message || `Could not start ${intg.name} connection`);
        return;
      }
      if (popup) popup.location.href = data.authUrl;
    } catch (e: any) {
      popup?.close();
      setPending(null);
      toast.error(e?.message ?? "Failed");
    }
  };

  const handleDisconnect = async (intg: OAuthIntegration) => {
    if (!user) return;
    setPending(intg.provider);
    await supabase.from("user_integrations").delete().eq("user_id", user.id).eq("provider", intg.provider);
    setPending(null);
    toast.success(`${intg.name} disconnected`);
    loadOAuth();
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Plug className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="font-display font-semibold text-sm text-foreground">Integrations</h1>
              <p className="text-[11px] text-muted-foreground">Connect your Google accounts. All features free.</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {OAUTH_INTEGRATIONS.map((intg) => {
              const Icon = intg.icon;
              const isConnected = !!connected[intg.provider];
              const isPending = pending === intg.provider;
              return (
                <div key={intg.id} className="p-4 rounded-xl border border-border bg-card">
                  <div className="flex items-start gap-3">
                    <div className={cn("w-10 h-10 rounded-lg bg-accent flex items-center justify-center shrink-0", intg.color)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-semibold text-sm text-foreground">{intg.name}</h3>
                        {isConnected && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 font-medium">
                            <Check className="w-3 h-3" /> Connected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{intg.description}</p>
                      {connected[intg.provider]?.label && (
                        <p className="text-[11px] text-muted-foreground mt-1 truncate">{connected[intg.provider]!.label}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    {isConnected ? (
                      <button
                        onClick={() => handleDisconnect(intg)}
                        disabled={isPending}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-accent disabled:opacity-50"
                      >
                        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Disconnect"}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnect(intg)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Connect</>}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Integrations;
