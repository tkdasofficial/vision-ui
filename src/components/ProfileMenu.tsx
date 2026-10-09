import { User, Settings, FileText, Shield, HelpCircle, LogOut, Clock, Crown, LayoutDashboard, Inbox } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ProfileMenu = () => {
  const navigate = useNavigate();
  const { profile, isAdmin, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center hover:bg-foreground/15 transition-colors">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            <User className="w-4 h-4 text-foreground" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {profile && (
          <>
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium text-foreground truncate">{profile.full_name || "User"}</p>
              <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => navigate("/app/account")}>
          <User className="w-4 h-4" />
          <span>Account</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => navigate("/app/settings")}>
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => navigate("/app/inbox")}>
          <Inbox className="w-4 h-4" />
          <span>Inbox</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2.5 cursor-pointer text-primary" onClick={() => navigate("/app/upgrade")}>
          <Crown className="w-4 h-4" />
          <span>Upgrade Plan</span>
        </DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => navigate("/admin/dashboard")}>
              <LayoutDashboard className="w-4 h-4" />
              <span>Admin Panel</span>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => navigate("/docs/terms-conditions")}>
          <FileText className="w-4 h-4" />
          <span>Terms & Conditions</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => navigate("/docs/privacy-policy")}>
          <Shield className="w-4 h-4" />
          <span>Privacy Policy</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => navigate("/app/support")}>
          <HelpCircle className="w-4 h-4" />
          <span>Support</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2.5 cursor-pointer text-destructive" onClick={handleSignOut}>
          <LogOut className="w-4 h-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ProfileMenu;
