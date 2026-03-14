import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import {
  Phone,
  Users,
  Calendar,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Zap,
  DollarSign,
  Headphones,
  Brain,
  Activity,
  Target,
  Award,
  Shield,
  UserCheck,
  Briefcase,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { TenantSelector } from "./TenantSelector";
import { useTenant } from "@/contexts/TenantContext";
import { useTranslation } from "react-i18next";



export function DashboardNav() {
  const { t, i18n } = useTranslation('common');
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const logoutMutation = trpc.auth.logout.useMutation();

  const handleLogout = async () => {
    // Confirmation avant déconnexion
    const confirmed = window.confirm(t('actions.confirm_logout', { defaultValue: "Voulez-vous vraiment vous déconnecter ?" }));
    if (!confirmed) return;
    
    await logoutMutation.mutateAsync();
    logout();
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  if (!user) return null;

  // Utiliser le contexte Tenant au lieu d'un fallback hardcodé
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
      icon: <BarChart3 className="w-5 h-5" />,
      roles: ["admin", "manager", "agent", "viewer"],
    },
    {
      label: t('nav.softphone'),
      href: "/softphone",
      icon: <Headphones className="w-5 h-5" />,
      roles: ["admin", "manager", "agent"],
    },
    {
      label: t('nav.ia_monitoring'),
      href: "/ia-monitoring",
      icon: <Brain className="w-5 h-5" />,
      roles: ["admin", "manager"],
    },
    {
      label: t('nav.bi_insights'),
      href: "/bi-insights",
      icon: <Target className="w-5 h-5" />,
      roles: ["admin", "manager"],
    },
    {
      label: t('nav.observability'),
      href: "/observability",
      icon: <Activity className="w-5 h-5" />,
      roles: ["admin"],
    },
    {
      label: t('nav.calls'),
      href: "/calls",
      icon: <Phone className="w-5 h-5" />,
      roles: ["admin", "manager", "agent"],
    },
    {
      label: t('nav.prospects'),
      href: "/prospects",
      icon: <Users className="w-5 h-5" />,
      roles: ["admin", "manager", "agent"],
    },
    {
      label: t('nav.appointments'),
      href: "/appointments",
      icon: <Calendar className="w-5 h-5" />,
      roles: ["admin", "manager", "agent"],
    },
    {
      label: t('nav.workflows'),
      href: "/workflows",
      icon: <Zap className="w-5 h-5" />,
      roles: ["admin", "manager"],
    },
    {
      label: t('nav.coaching'),
      href: "/coaching",
      icon: <Award className="w-5 h-5" />,
      roles: ["admin", "manager", "agent"],
    },
    {
      label: t('nav.compliance'),
      href: "/compliance",
      icon: <Shield className="w-5 h-5" />,
      roles: ["admin"],
    },
    {
      label: t('nav.billing'),
      href: "/billing",
      icon: <DollarSign className="w-5 h-5" />,
      roles: ["admin"],
    },
    {
      label: t('nav.recruitment', { defaultValue: 'Recrutement' }),
      href: "/recruitment",
      icon: <UserCheck className="w-5 h-5" />,
      roles: ["admin", "manager"],
    },
    {
      label: t('nav.recruitment_enhanced', { defaultValue: 'Recrutement IA' }),
      href: "/recruitment-enhanced",
      icon: <Briefcase className="w-5 h-5" />,
      roles: ["admin", "manager"],
    },
    {
      label: t('nav.social_manager', { defaultValue: 'Social Manager' }),
      href: "/social-manager",
      icon: <Share2 className="w-5 h-5" />,
      roles: ["admin", "manager"],
    },
    {
      label: t('nav.settings'),
      href: "/settings",
      icon: <Settings className="w-5 h-5" />,
      roles: ["admin"],
    },
  ];

  const visibleNavItems = navItems.filter((item) =>
    item.roles.includes(tenantRole)
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden bg-card border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="text-lg font-bold text-primary">{t('app_name')} CRM</div>
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

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border transition-transform duration-300 lg:static lg:translate-x-0 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-border">
            <h1 className="text-2xl font-bold text-primary">{t('app_name')}</h1>
            <p className="text-xs text-muted-foreground mt-1">{t('nav.tagline', { defaultValue: 'CRM Intelligent' })}</p>
          </div>

          {/* Tenant Selector */}
          <div className="p-4 border-b border-border">
            <TenantSelector />
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {visibleNavItems.map((item) => {
                const isActive = location.startsWith(item.href);
                return (
                  <a
                    key={item.href}
                    href={`${item.href}?tenantId=${tenantId}`}
                    className={`flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-muted hover:scale-[0.98] active:scale-95 ${
                      isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:text-primary"
                    }`}
                    onClick={() => setIsMobileOpen(false)}
                  >
                    <div className="flex items-center gap-3">
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                  </a>
                );
              })}
            </div>
          </nav>

          {/* User Profile & Logout */}
          <div className="p-4 border-t border-border">
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            
            <div className="flex gap-2 mb-4">
               <Button variant="outline" size="sm" onClick={() => changeLanguage('fr')} className={i18n.language === 'fr' ? 'bg-primary/10' : ''}>FR</Button>
               <Button variant="outline" size="sm" onClick={() => changeLanguage('en')} className={i18n.language === 'en' ? 'bg-primary/10' : ''}>EN</Button>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="w-4 h-4 mr-2" />
              {t('actions.logout', { defaultValue: 'Déconnexion' })}
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
    </>
  );
}
