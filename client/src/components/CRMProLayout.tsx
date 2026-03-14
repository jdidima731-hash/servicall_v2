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
  Activity,
  Target,
  Award,
  Shield,
  UserCheck,
  Briefcase,
  Share2,
  Calendar,
  Workflow,
  ChevronDown,
  Bell,
  Search,
  Moon,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { TenantSelector } from "./TenantSelector";
import { useTenant } from "@/contexts/TenantContext";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/**
 * CRM Pro Layout - Fusion Premium V3.4 + V5
 * Design professionnel avec menu latéral complet et topbar moderne
 */
export function CRMProLayout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation('common');
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const logoutMutation = trpc.auth.logout.useMutation();
  const { tenantId: contextTenantId } = useTenant();

  const handleLogout = async () => {
    const confirmed = window.confirm(t('actions.confirm_logout', { defaultValue: "Voulez-vous vraiment vous déconnecter ?" }));
    if (!confirmed) return;
    await logoutMutation.mutateAsync();
    logout();
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  if (!user) return null;

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
      category: "Supervision"
    },
    {
      label: t('nav.ia_monitoring'),
      href: "/ia-monitoring",
      icon: Brain,
      roles: ["admin", "manager"],
      category: "Supervision"
    },
    {
      label: t('nav.calls'),
      href: "/calls",
      icon: Phone,
      roles: ["admin", "manager", "agent"],
      category: "Communication"
    },
    {
      label: t('nav.prospects'),
      href: "/prospects",
      icon: Users,
      roles: ["admin", "manager", "agent"],
      category: "Communication"
    },
    {
      label: t('nav.campaigns'),
      href: "/campaigns",
      icon: Target,
      roles: ["admin", "manager"],
      category: "Communication"
    },
    {
      label: t('nav.messages'),
      href: "/messages",
      icon: MessageSquare,
      roles: ["admin", "manager", "agent"],
      category: "Communication"
    },
    {
      label: t('nav.appointments'),
      href: "/appointments",
      icon: Calendar,
      roles: ["admin", "manager", "agent"],
      category: "Communication"
    },
    {
      label: t('nav.workflows'),
      href: "/workflows",
      icon: Workflow,
      roles: ["admin", "manager"],
      category: "Automation"
    },
    {
      label: t('nav.coaching'),
      href: "/coaching",
      icon: Award,
      roles: ["admin", "manager", "agent"],
      category: "Performance"
    },
    {
      label: t('nav.compliance'),
      href: "/compliance",
      icon: Shield,
      roles: ["admin"],
      category: "Administration"
    },
    {
      label: t('nav.billing'),
      href: "/billing",
      icon: DollarSign,
      roles: ["admin"],
      category: "Administration"
    },
    {
      label: t('nav.recruitment', { defaultValue: 'Recrutement' }),
      href: "/recruitment",
      icon: UserCheck,
      roles: ["admin", "manager"],
      category: "Administration"
    },
    {
      label: t('nav.recruitment_enhanced', { defaultValue: 'Recrutement IA' }),
      href: "/recruitment-enhanced",
      icon: Briefcase,
      roles: ["admin", "manager"],
      category: "Administration"
    },
    {
      label: t('nav.social_manager', { defaultValue: 'Social Manager' }),
      href: "/social-manager",
      icon: Share2,
      roles: ["admin", "manager"],
      category: "Administration"
    },
    {
      label: t('nav.settings'),
      href: "/settings",
      icon: Settings,
      roles: ["admin"],
      category: "Administration"
    },
  ];

  const visibleNavItems = navItems.filter((item) =>
    item.roles.includes(tenantRole)
  );

  // Grouper les items par catégorie
  const groupedNavItems = visibleNavItems.reduce((acc, item) => {
    const category = item.category || "Autres";
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, typeof visibleNavItems>);

  const categories = ["Supervision", "Communication", "Automation", "Performance", "Administration"];

  return (
    <div className={cn("min-h-screen", isDarkMode ? "dark bg-slate-950" : "bg-slate-50")}>
      {/* Mobile Header */}
      <div className="lg:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40">
        <div className="flex items-center justify-between p-4">
          <div className="text-lg font-bold text-primary">Servicall CRM</div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
          >
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar Desktop */}
        <aside className={cn(
          "hidden lg:flex flex-col fixed left-0 top-0 h-screen w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300 z-40 overflow-y-auto",
        )}>
          {/* Logo & Branding */}
          <div className="p-6 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                <Phone className="text-white w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 dark:text-white">Servicall</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">CRM PRO v5</p>
              </div>
            </div>
          </div>

          {/* Tenant Selector */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <TenantSelector />
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-6">
            {categories.map((category) => {
              const items = groupedNavItems[category];
              if (!items || items.length === 0) return null;

              return (
                <div key={category}>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-4 mb-3">
                    {category}
                  </p>
                  <div className="space-y-2">
                    {items.map((item) => {
                      const isActive = location.startsWith(item.href);
                      const Icon = item.icon;

                      return (
                        <a
                          key={item.href}
                          href={`${item.href}?tenantId=${tenantId}`}
                          className={cn(
                            "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                            isActive
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          )}
                          onClick={() => setIsMobileOpen(false)}
                        >
                          <Icon className="w-5 h-5 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <p className="text-sm font-bold text-slate-900 dark:text-white">{user.name}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">{user.email}</p>
            </div>

            <div className="flex gap-2">
              <Button
                variant={i18n.language === 'fr' ? 'default' : 'outline'}
                size="sm"
                onClick={() => changeLanguage('fr')}
                className="flex-1 text-xs font-bold"
              >
                FR
              </Button>
              <Button
                variant={i18n.language === 'en' ? 'default' : 'outline'}
                size="sm"
                onClick={() => changeLanguage('en')}
                className="flex-1 text-xs font-bold"
              >
                EN
              </Button>
            </div>

            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="w-4 h-4 mr-2" />
              {t('actions.logout', { defaultValue: 'Déconnexion' })}
            </Button>
          </div>
        </aside>

        {/* Mobile Sidebar Overlay */}
        {isMobileOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        {/* Mobile Sidebar */}
        <aside className={cn(
          "fixed left-0 top-16 h-[calc(100vh-64px)] w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-sm transition-transform duration-300 z-40 overflow-y-auto lg:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <nav className="p-4 space-y-6">
            {categories.map((category) => {
              const items = groupedNavItems[category];
              if (!items || items.length === 0) return null;

              return (
                <div key={category}>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-4 mb-3">
                    {category}
                  </p>
                  <div className="space-y-2">
                    {items.map((item) => {
                      const isActive = location.startsWith(item.href);
                      const Icon = item.icon;

                      return (
                        <a
                          key={item.href}
                          href={`${item.href}?tenantId=${tenantId}`}
                          className={cn(
                            "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                            isActive
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          )}
                          onClick={() => setIsMobileOpen(false)}
                        >
                          <Icon className="w-5 h-5 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-72">
          {/* Top Bar */}
          <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 gap-4">
              {/* Search */}
              <div className="flex-1 max-w-md hidden md:block">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder={t('common:placeholders.search', 'Rechercher...')}
                    className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Right Actions */}
              <div className="flex items-center gap-4 ml-auto">
                {/* Notifications */}
                <button className="relative p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                </button>

                {/* Theme Toggle */}
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                >
                  {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>

                {/* Profile Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-blue-600 text-white font-bold">
                          {user.name?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <ChevronDown className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem disabled className="text-xs text-slate-500">
                      {user.email}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Mon Profil</DropdownMenuItem>
                    <DropdownMenuItem>Paramètres</DropdownMenuItem>
                    <DropdownMenuItem>Aide & Support</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                      <LogOut className="w-4 h-4 mr-2" />
                      Déconnexion
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <div className="p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
