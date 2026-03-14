import React, { useState } from "react";
import {
  Menu,
  X,
  BarChart3,
  Phone,
  Calendar,
  Zap,
  Settings,
  LogOut,
  Bell,
  Search,
  Moon,
  Sun,
  User,
  ChevronDown,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";

interface PremiumLayoutProps {
  children: React.ReactNode;
}

export function PremiumLayout({ children }: PremiumLayoutProps) {
  const { t } = useTranslation(['common']);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [location] = useLocation();

  const navigationItems = [
    { label: "Dashboard", icon: BarChart3, href: "/dashboard" },
    { label: "Appels", icon: Phone, href: "/calls" },
    { label: "Calendrier", icon: Calendar, href: "/calendar" },
    { label: "Workflows", icon: Zap, href: "/workflows" },
    { label: "Enregistrements", icon: Phone, href: "/recordings" },
    { label: "Paramètres", icon: Settings, href: "/settings" },
  ];

  const isActive = (href: string) => location === href;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full bg-gradient-to-b from-slate-900 to-slate-950 border-r border-slate-700 transition-all duration-300 z-40 ${
          isSidebarOpen ? "w-64" : "w-20"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className={`flex items-center gap-3 ${!isSidebarOpen && "justify-center w-full"}`}>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Phone className="text-white" size={24} />
            </div>
            {isSidebarOpen && (
              <div>
                <h1 className="text-xl font-bold text-white">Servicall</h1>
                <p className="text-xs text-slate-400">v2.0</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          {navigationItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <a
                className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive(item.href)
                    ? "bg-primary/20 text-primary border border-primary/50 shadow-lg shadow-primary/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                <item.icon size={20} />
                {isSidebarOpen && <span className="font-medium">{item.label}</span>}
              </a>
            </Link>
          ))}
        </nav>

        {/* Toggle Button */}
        <div className="absolute bottom-6 left-0 right-0 px-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-600 text-slate-300 transition-all"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`transition-all duration-300 ${
          isSidebarOpen ? "ml-64" : "ml-20"
        }`}
      >
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-gradient-to-r from-slate-800/80 to-slate-900/80 backdrop-blur-md border-b border-slate-700/50">
          <div className="flex items-center justify-between px-8 py-4">
            {/* Search */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="text"
                  placeholder={t('common:placeholders.search', 'Rechercher...')}
                  className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-4 ml-8">
              {/* Notifications */}
              <button className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all">
                <Bell size={20} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full animate-pulse"></span>
              </button>

              {/* Theme Toggle */}
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all"
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              {/* Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-600 text-white transition-all"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <User size={16} />
                  </div>
                  <span className="font-medium">Jean Dupont</span>
                  <ChevronDown size={16} />
                </button>

                {/* Dropdown Menu */}
                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
                    <a
                      href="/profile"
                      className="block px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 first:rounded-t-lg transition-all"
                    >
                      Mon Profil
                    </a>
                    <a
                      href="/settings"
                      className="block px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 transition-all"
                    >
                      Paramètres
                    </a>
                    <a
                      href="/help"
                      className="block px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 transition-all"
                    >
                      Aide
                    </a>
                    <hr className="border-slate-700 my-2" />
                    <button className="w-full text-left px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 last:rounded-b-lg flex items-center gap-2 transition-all">
                      <LogOut size={16} />
                      Déconnexion
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

// ============================================
// PREMIUM COMPONENTS
// ============================================

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: number;
  icon?: React.ReactNode;
  color?: string;
}

export function StatCard({ label, value, unit, trend, icon, color = "primary" }: StatCardProps) {
  const colorClasses = {
    primary: "from-primary to-primary-light",
    success: "from-success to-cyan-500",
    warning: "from-warning to-orange-500",
    error: "from-error to-red-500",
  };

  // ✅ BLOC 2: Ne pas afficher de trend si la valeur est à 0 (données insuffisantes)
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  const shouldShowTrend = trend !== undefined && numericValue > 0;

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-slate-700 shadow-xl transition-all duration-300 hover:translate-y-[-4px] hover:shadow-2xl group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm mb-2">{label}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold text-white">{value}</h3>
            {unit && <span className="text-slate-400 text-sm">{unit}</span>}
          </div>
          {shouldShowTrend ? (
            <p className={`text-sm mt-2 ${trend >= 0 ? "text-success" : "text-error"}`}>
              {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
            </p>
          ) : trend !== undefined && numericValue === 0 ? (
            <p className="text-slate-500 text-sm mt-2" title="Données insuffisantes pour calculer l'évolution">
              —
            </p>
          ) : null}
        </div>
        {icon && (
          <div className={`p-3 rounded-lg bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} opacity-20 group-hover:opacity-30 transition-all`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

interface ProgressRingProps {
  percentage: number;
  label: string;
  size?: number;
}

export function ProgressRing({ percentage, label, size = 120 }: ProgressRingProps) {
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(148, 163, 184, 0.2)"
          strokeWidth="8"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#gradient)"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: "stroke-dashoffset 0.5s ease",
          }}
        />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="text-center mt-4">
        <p className="text-2xl font-bold text-white">{percentage}%</p>
        <p className="text-sm text-slate-400">{label}</p>
      </div>
    </div>
  );
}
