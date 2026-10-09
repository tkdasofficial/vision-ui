import {
  User,
  Settings,
  FileText,
  Shield,
  HelpCircle,
  LogOut,
  Clock,
  Crown,
  LayoutDashboard,
  Inbox,
  MoreVertical,
} from "lucide-react";
import { useNavigate } from "@/lib/router-compat";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ProfileMenu = ({ conversation = false }: { conversation?: boolean }) => {
  const navigate = useNavigate();
  const { profile, isAdmin, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open profile menu"
          className={
            conversation
              ? "size-ui-control shrink-0 rounded-full bg-transparent [&_svg]:size-ui-icon"
              : "size-ui-control shrink-0 rounded-full bg-floating border border-border flex items-center justify-center hover:bg-accent transition-colors"
          }
        >
          {conversation ? (
            <MoreVertical />
          ) : profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <span className="flex size-6 items-center justify-center rounded-full bg-avatar text-xs font-normal text-avatar-foreground">
              {(profile?.full_name || "User")
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {profile && (
          <>
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium text-foreground truncate">
                {profile.full_name || "User"}
              </p>
              <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          className="gap-2.5 cursor-pointer"
          onClick={() => navigate("/app/account")}
        >
          <User className="w-4 h-4" />
          <span>Account</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2.5 cursor-pointer"
          onClick={() => navigate("/app/settings")}
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2.5 cursor-pointer" onClick={() => navigate("/app/inbox")}>
          <Inbox className="w-4 h-4" />
          <span>Inbox</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2.5 cursor-pointer text-primary"
          onClick={() => navigate("/app/upgrade")}
        >
          <Crown className="w-4 h-4" />
          <span>Upgrade Plan</span>
        </DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2.5 cursor-pointer"
              onClick={() => navigate("/admin/dashboard")}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Admin Panel</span>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2.5 cursor-pointer"
          onClick={() => navigate("/docs/terms-conditions")}
        >
          <FileText className="w-4 h-4" />
          <span>Terms & Conditions</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2.5 cursor-pointer"
          onClick={() => navigate("/docs/privacy-policy")}
        >
          <Shield className="w-4 h-4" />
          <span>Privacy Policy</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2.5 cursor-pointer"
          onClick={() => navigate("/app/support")}
        >
          <HelpCircle className="w-4 h-4" />
          <span>Support</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2.5 cursor-pointer text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ProfileMenu;
