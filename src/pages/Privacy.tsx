import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import ProfileMenu from "@/components/ProfileMenu";

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-display font-semibold text-foreground">Privacy Policy</h1>
        <ProfileMenu />
      </header>

      <div className="flex-1 px-4 py-6 sm:px-6 overflow-y-auto">
        <div className="max-w-lg mx-auto">
          <h2 className="font-display text-lg font-semibold text-foreground mb-4">Privacy Policy</h2>
          <p className="text-sm text-muted-foreground mb-4">Last updated: March 6, 2026</p>

          {[
            { title: "Information We Collect", content: "We collect information you provide directly: account details (name, email), content you generate, conversation history, and usage data. We also collect device information, IP address, and browser type automatically." },
            { title: "How We Use Your Information", content: "We use your data to provide and improve our services, personalize your experience, communicate updates, ensure security, and comply with legal obligations. Your AI-generated content is processed to deliver results but is not used to train our models without consent." },
            { title: "Data Storage & Security", content: "Your data is encrypted in transit and at rest. We use industry-standard security measures to protect your information. Conversation data is stored on secure servers and retained for the duration of your account." },
            { title: "Data Sharing", content: "We do not sell your personal information. We may share data with trusted service providers who assist in operating our platform, subject to confidentiality agreements. We may disclose information when required by law." },
            { title: "Your Rights", content: "You can access, correct, or delete your personal data at any time through account settings. You can export your data, opt out of marketing communications, and request account deletion." },
            { title: "Cookies", content: "We use essential cookies for authentication and preferences. Analytics cookies help us understand usage patterns. You can manage cookie preferences in your browser settings." },
            { title: "Contact Us", content: "For privacy inquiries, contact us at privacy@supercopilot.ai or through the Support page." },
          ].map((section, i) => (
            <div key={i} className="mb-5">
              <h3 className="text-sm font-display font-semibold text-foreground mb-2">{section.title}</h3>
              <p className="text-sm text-secondary-foreground leading-relaxed">{section.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Privacy;
