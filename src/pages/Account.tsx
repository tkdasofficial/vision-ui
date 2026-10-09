import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Mail, KeyRound, ShieldCheck, Smartphone, Copy, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ProfileMenu from "@/components/ProfileMenu";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type TwoFAMethod = "none" | "email" | "totp";

const Account = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, user } = useAuth();
  const [name, setName] = useState(profile?.full_name || "");
  const [sub, setSub] = useState<any>(null);
  const [twoFAMethod, setTwoFAMethod] = useState<TwoFAMethod>("none");
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // TOTP enrollment state
  const [totpSetup, setTotpSetup] = useState<{
    qr: string;
    secret: string;
    factorId: string;
  } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpVerifying, setTotpVerifying] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);

  useEffect(() => {
    if (profile) setName(profile.full_name || "");
  }, [profile]);

  useEffect(() => {
    if (user) {
      supabase.from("subscriptions").select("*").eq("user_id", user.id).single().then(({ data }) => {
        if (data) setSub(data);
      });
      supabase.from("user_2fa").select("enabled, method").eq("user_id", user.id).maybeSingle().then(({ data }) => {
        if (data && data.enabled) {
          setTwoFAMethod((data as any).method || "email");
        }
      });
    }
  }, [user]);

  const saveName = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ full_name: name, updated_at: new Date().toISOString() }).eq("id", user.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated" });
    }
  };

  const save2FA = async (method: TwoFAMethod) => {
    if (!user) return;
    const enabled = method !== "none";
    const { data: existing } = await supabase.from("user_2fa").select("id").eq("user_id", user.id).maybeSingle();
    if (existing) {
      await supabase.from("user_2fa").update({ enabled, method, updated_at: new Date().toISOString() } as any).eq("user_id", user.id);
    } else {
      await supabase.from("user_2fa").insert({ user_id: user.id, enabled, method } as any);
    }
    setTwoFAMethod(method);
  };

  const handleEnableEmail = async () => {
    setTwoFALoading(true);
    await save2FA("email");
    setTwoFALoading(false);
    toast({ title: "Email 2FA enabled", description: "You'll receive a code via email on each login." });
  };

  const handleStartTOTP = async () => {
    setTwoFALoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) throw error;
      setTotpSetup({
        qr: data.totp.qr_code,
        secret: data.totp.secret,
        factorId: data.id,
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleVerifyTOTP = async () => {
    if (!totpSetup || totpCode.length < 6) return;
    setTotpVerifying(true);
    try {
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: totpSetup.factorId });
      if (cErr) throw cErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: totpSetup.factorId,
        challengeId: challenge.id,
        code: totpCode,
      });
      if (vErr) throw vErr;
      await save2FA("totp");
      setTotpSetup(null);
      setTotpCode("");
      toast({ title: "Authenticator app enabled", description: "You'll need the app code on each login." });
    } catch (e: any) {
      toast({ title: "Verification failed", description: e.message, variant: "destructive" });
    } finally {
      setTotpVerifying(false);
    }
  };

  const handleDisable2FA = async () => {
    setTwoFALoading(true);
    // Unenroll TOTP factors if any
    if (twoFAMethod === "totp") {
      const { data } = await supabase.auth.mfa.listFactors();
      if (data?.totp) {
        for (const f of data.totp) {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }
    }
    await save2FA("none");
    setTwoFALoading(false);
    setTotpSetup(null);
    toast({ title: "2FA disabled" });
  };

  const copySecret = () => {
    if (totpSetup?.secret) {
      navigator.clipboard.writeText(totpSetup.secret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-display font-semibold text-foreground">Account</h1>
        <ProfileMenu />
      </header>

      <div className="flex-1 px-4 py-6 sm:px-6 overflow-y-auto">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Profile */}
          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-4">Profile</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-foreground/10 flex items-center justify-center overflow-hidden">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-7 h-7 text-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{name || "User"}</p>
                  <p className="text-xs text-muted-foreground">{sub?.plan || "free"} plan</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground outline-none focus:border-foreground/20 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</label>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">{profile?.email || user?.email || ""}</span>
                </div>
              </div>

              <button onClick={saveName} className="w-full py-2.5 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity">
                Save changes
              </button>
            </div>
          </section>

          {/* Security */}
          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-4">Security</h2>
            <div className="space-y-4">
              {/* Reset password */}
              <button
                onClick={async () => {
                  const email = profile?.email || user?.email;
                  if (!email) return;
                  setResetLoading(true);
                  const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/reset-password`,
                  });
                  setResetLoading(false);
                  if (error) {
                    toast({ title: "Error", description: error.message, variant: "destructive" });
                  } else {
                    toast({ title: "Check your email", description: "We sent you a password reset link." });
                  }
                }}
                disabled={resetLoading}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:bg-accent transition-colors text-left"
              >
                <KeyRound className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Reset Password</p>
                  <p className="text-xs text-muted-foreground">Send a password reset link to your email</p>
                </div>
                {resetLoading && <div className="w-4 h-4 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />}
              </button>

              {/* 2FA Section */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <ShieldCheck className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Two-Factor Authentication</p>
                    <p className="text-xs text-muted-foreground">
                      {twoFAMethod === "none"
                        ? "Add an extra layer of security"
                        : twoFAMethod === "email"
                        ? "Email code active"
                        : "Authenticator app active"}
                    </p>
                  </div>
                  {twoFAMethod !== "none" && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      On
                    </span>
                  )}
                </div>

                <div className="border-t border-border px-4 py-3 space-y-3">
                  {/* TOTP option */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Smartphone className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-foreground">Authenticator App</p>
                        <p className="text-[11px] text-muted-foreground">Google Authenticator, Authy, etc.</p>
                      </div>
                    </div>
                    {twoFAMethod === "totp" ? (
                      <button
                        onClick={handleDisable2FA}
                        disabled={twoFALoading}
                        className="text-xs font-medium text-destructive hover:underline"
                      >
                        Disable
                      </button>
                    ) : (
                      <button
                        onClick={handleStartTOTP}
                        disabled={twoFALoading || twoFAMethod === "email"}
                        className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                      >
                        {twoFALoading ? "..." : "Enable"}
                      </button>
                    )}
                  </div>

                  {/* TOTP Setup flow */}
                  {totpSetup && (
                    <div className="rounded-lg border border-border bg-background p-4 space-y-4">
                      <p className="text-xs text-muted-foreground text-center">
                        Scan this QR code with your authenticator app
                      </p>
                      <div className="flex justify-center">
                        <img src={totpSetup.qr} alt="TOTP QR Code" className="w-48 h-48 rounded-lg" />
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-[11px] bg-muted px-3 py-2 rounded-lg text-foreground break-all select-all">
                          {totpSetup.secret}
                        </code>
                        <button onClick={copySecret} className="p-2 rounded-lg hover:bg-accent transition-colors shrink-0">
                          {secretCopied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground text-center">Enter the 6-digit code from the app</p>
                      <div className="flex justify-center">
                        <InputOTP maxLength={6} value={totpCode} onChange={setTotpCode}>
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setTotpSetup(null); setTotpCode(""); }}
                          className="flex-1 py-2 rounded-xl border border-border text-sm text-foreground hover:bg-accent transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleVerifyTOTP}
                          disabled={totpVerifying || totpCode.length < 6}
                          className="flex-1 py-2 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          {totpVerifying ? "Verifying..." : "Verify & Enable"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Email OTP option */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-foreground">Email Code</p>
                        <p className="text-[11px] text-muted-foreground">Receive a code via email on login</p>
                      </div>
                    </div>
                    {twoFAMethod === "email" ? (
                      <button
                        onClick={handleDisable2FA}
                        disabled={twoFALoading}
                        className="text-xs font-medium text-destructive hover:underline"
                      >
                        Disable
                      </button>
                    ) : (
                      <button
                        onClick={handleEnableEmail}
                        disabled={twoFALoading || twoFAMethod === "totp"}
                        className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                      >
                        {twoFALoading ? "..." : "Enable"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Account;
