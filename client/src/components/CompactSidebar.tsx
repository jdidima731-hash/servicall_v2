import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import {
  Phone,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  MessageSquare,
  DollarSign,
  Headphones,
  Brain,
  ChevronLeft,
  ChevronRight,
  Wrench,
  Share2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { TenantSelector } from "./TenantSelector";
import { useTenant } from "@/contexts/TenantContext";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useCallStore } from "@/lib/callStore";
import { Badge } from "@/components/ui/badge";

export function CompactSidebar() {
  const { t } = useTranslation('common');
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { isSoftphoneOpen, setSoftphoneOpen } = useCallStore();
  const logoutMutation = trpc.auth.logout.useMutation();

  const handleLogout = async () => {
    const confirmed = window.confirm("Voulez-vous vraiment vous déconnecter ?");
    if (!confirmed) return;
    
    await logoutMutation.mutateAsync();
    logout();
  };

  if (!user) return null;

  const { tenantId: contextTenantId } = useTenant();
  const tenantId = contextTenantId?.toString() || new URLSearchParams(window.location.search).get("tenantId");
  const userRole = user.role || "agent";

  const getTenantRole = () => {
    const storedTenantRole = localStorage.getItem('tenantRole');
    if (storedTenantRole) return storedTenantRole;
    return userRole === 'admin' ? 'admin' : (userRole === 'viewer' ? 'viewer' : userRole);
  };
  
  const tenantRole = getTenantRole();

  const navItems = [
    {
      label: t('nav.dashboard'),
      href: "/dashboard",
      icon: BarChart3,
      roles: ["admin", "manager", "agent", "viewer"],
    },
    {
      label: t('nav.ia_monitoring'),
      href: "/ia-monitoring",
      icon: Brain,
      roles: ["admin", "manager"],
    },
    {
      label: t('nav.calls'),
      href: "/calls",
      icon: Phone,
      roles: ["admin", "manager", "agent"],
    },
    {
      label: t('nav.prospects'),
      href: "/prospects",
      icon: Users,
      roles: ["admin", "manager", "agent"],
      badge: "Pipeline"
    },
    {
      label: t('nav.messages'),
      href: "/messages",
      icon: MessageSquare,
      roles: ["admin", "manager", "agent"],
      isNew: true
    },
    {
      label: t('nav.workflows'),
      href: "/workflows",
      icon: Wrench,
      roles: ["admin", "manager"],
      badge: "IA"
    },
    {
      label: t('nav.billing'),
      href: "/invoices",
      icon: DollarSign,
      roles: ["admin", "manager", "agent"],
    },
    {
      label: t('nav.social_manager', { defaultValue: 'Social Manager' }),
      href: "/social-manager",
      icon: Share2,
      roles: ["admin", "manager"],
      isNew: true
    },
    {
      label: t('nav.settings'),
      href: "/settings",
      icon: Settings,
      roles: ["admin"],
    },
  ];

  const visibleNavItems = navItems.filter((item) =>
    item.roles.includes(tenantRole) && !(item as any).hidden
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden bg-card border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="text-lg font-bold text-primary">Servicall</div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
          >
            {isMobileOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Sidebar Desktop */}
      <aside
        className={cn(
          "hidden lg:flex flex-col bg-card border-r border-border/20 transition-all duration-300 ease-in-out z-50 shadow-sm",
          isExpanded ? "w-64" : "w-20"
        )}
      >
        {/* Logo & Toggle */}
        <div className="h-20 border-b border-border flex items-center justify-center relative">
          {isExpanded ? (
            <div className="px-6 w-full">
              <h1 className="text-2xl font-black text-primary tracking-tighter">Servicall</h1>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Command Center</p>
              </div>
            </div>
          ) : (
            <div className="text-2xl font-black text-primary">S</div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="absolute -right-3 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full border border-border bg-white shadow-md hover:scale-110 transition-transform"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Tenant Selector */}
        {isExpanded && (
          <div className="p-4 border-b border-border bg-slate-50/50">
            <TenantSelector />
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6">
          <div className={cn("space-y-2", isExpanded ? "px-4" : "px-3")}>
            {/* Softphone Toggle */}
            <button
              onClick={() => setSoftphoneOpen(!isSoftphoneOpen)}
              className={cn(
                "flex items-center gap-3 rounded-2xl transition-all duration-300 w-full relative group",
                isExpanded ? "px-4 py-3" : "px-0 py-3 justify-center",
                isSoftphoneOpen
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Headphones className={cn("shrink-0", isExpanded ? "w-5 h-5" : "w-6 h-6", isSoftphoneOpen && "animate-pulse")} />
              {isExpanded && (
                <span className="text-sm font-black uppercase tracking-tighter">Softphone</span>
              )}
              {!isExpanded && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary animate-ping" />
              )}
            </button>

            <div className="h-4" />

            {visibleNavItems.map((item) => {
              const isActive = location.startsWith(item.href);
              const Icon = item.icon;
              
              const NavButton = (
                <a
                  key={item.href}
                  href={`${item.href}?tenantId=${tenantId}`}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl transition-all duration-300 relative group",
                    isExpanded ? "px-4 py-3" : "px-0 py-3 justify-center",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "text-slate-600 hover:bg-primary/5 hover:text-primary"
                  )}
                  onClick={() => setIsMobileOpen(false)}
                >
                  <Icon className={cn("shrink-0", isExpanded ? "w-5 h-5" : "w-6 h-6")} />
                  {isExpanded && (
                    <div className="flex items-center justify-between flex-1 min-w-0">
                      <span className="text-sm font-bold truncate">{item.label}</span>
                      {item.isNew && (
                        <Badge className="bg-primary text-[8px] h-4 px-1 font-black uppercase tracking-tighter">New</Badge>
                      )}
                      {item.badge && !item.isNew && (
                        <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity">{item.badge}</span>
                      )}
                    </div>
                  )}
                  {!isExpanded && (item.isNew || item.badge) && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                  )}
                </a>
              );

              if (!isExpanded) {
                return (
                  <Tooltip key={item.href} delayDuration={0}>
                    <TooltipTrigger asChild>
                      {NavButton}
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-bold text-xs bg-slate-900 text-white border-none px-3 py-2 rounded-lg shadow-xl">
                      {item.label}
                      {item.isNew && " (Nouveau)"}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return NavButton;
            })}
          </div>
        </nav>

        {/* User Profile & Logout */}
        <div className="p-4 border-t border-border bg-slate-50/30">
          {isExpanded ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-2 rounded-2xl bg-white border border-slate-100 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black">
                  {user.name.substring(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black truncate text-slate-900">{user.name}</p>
                  <p className="text-[10px] font-bold text-slate-400 truncate uppercase tracking-tighter">{tenantRole}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                className="w-full rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-bold transition-colors"
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
              >
                <LogOut className="w-4 h-4 mr-2" />
                DÉCONNEXION
              </Button>
            </div>
          ) : (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-full h-12 rounded-2xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                  onClick={handleLogout}
                  disabled={logoutMutation.isPending}
                >
                  <LogOut className="w-6 h-6" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-bold text-xs bg-rose-600 text-white border-none">
                Déconnexion
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </aside>
    </>
  );
}
