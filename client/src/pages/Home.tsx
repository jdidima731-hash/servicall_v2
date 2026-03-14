import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Phone, Users, BarChart3, RefreshCw, 
  ArrowRight, Zap, MessageSquare,
  Briefcase, Mic, Target, Lock, CheckCircle, Rocket
} from "lucide-react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Home() {
  const { t } = useTranslation('common');
  const { loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const handleStart = () => {
    if (isAuthenticated) {
      setLocation("/dashboard");
    } else {
      setLocation("/login");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('actions.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      {/* Navigation */}
      <nav className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-xl">
              <Phone className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-black tracking-tighter">SERVICALL<span className="text-primary">.</span></span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-primary transition-colors">{t('nav.features')}</a>
            <a href="#ia" className="hover:text-primary transition-colors">{t('nav.ai')}</a>
            <a href="#services" className="hover:text-primary transition-colors">{t('nav.services')}</a>
            <a href="#pricing" className="hover:text-primary transition-colors">{t('nav.pricing')}</a>
          </div>

          <div className="flex items-center gap-4">
            <LanguageSelector />
            <Button variant="ghost" className="hidden sm:flex" onClick={handleStart}>
              {isAuthenticated ? t('nav.dashboard') : t('nav.login')}
            </Button>
            <Button className="rounded-full px-6 shadow-lg shadow-primary/20" onClick={handleStart}>
              {isAuthenticated ? t('nav.dashboard') : t('home.start_free')}
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-400/5 rounded-full blur-[100px]"></div>
        </div>

        <div className="container mx-auto px-4 text-center space-y-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-bold animate-bounce">
            <Rocket className="h-4 w-4" />
            <span>🚀 Enterprise SaaS Platform v3.3</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.9] max-w-5xl mx-auto">
            Plateforme CRM IA <span className="text-primary">Enterprise</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Servicall V3.3 : Automation Marketing, Voice AI, Recrutement IA, Lead Scoring et Workflows avancés pour transformer votre business
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
            <Button size="lg" className="h-16 px-10 text-xl rounded-full shadow-2xl shadow-primary/30 group" onClick={handleStart}>
              {isAuthenticated ? t('nav.dashboard') : t('home.start_free_now')}
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button size="lg" variant="outline" className="h-16 px-10 text-xl rounded-full" onClick={() => setLocation("/login")}>
              {t('home.view_demo')}
            </Button>
          </div>

          <div className="pt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            <div className="flex items-center justify-center font-bold text-2xl tracking-tighter italic">{t('home.trusted')}</div>
            <div className="flex items-center justify-center font-bold text-2xl tracking-tighter italic">{t('home.reliable')}</div>
            <div className="flex items-center justify-center font-bold text-2xl tracking-tighter italic">{t('home.secure')}</div>
            <div className="flex items-center justify-center font-bold text-2xl tracking-tighter italic">{t('home.global')}</div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-primary py-16 text-primary-foreground">
        <div className="container mx-auto px-4 grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          <div className="space-y-2">
            <div className="text-4xl md:text-5xl font-black">+30%</div>
            <div className="text-primary-foreground/70 font-medium">Productivité</div>
          </div>
          <div className="space-y-2">
            <div className="text-4xl md:text-5xl font-black">100%</div>
            <div className="text-primary-foreground/70 font-medium">Transcription IA</div>
          </div>
          <div className="space-y-2">
            <div className="text-4xl md:text-5xl font-black">-40%</div>
            <div className="text-primary-foreground/70 font-medium">Temps de formation</div>
          </div>
          <div className="space-y-2">
            <div className="text-4xl md:text-5xl font-black">24/7</div>
            <div className="text-primary-foreground/70 font-medium">Disponibilité</div>
          </div>
        </div>
      </section>

      {/* Main Features Grid */}
      <section id="features" className="py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4 mb-20">
            <h2 className="text-sm font-black uppercase tracking-widest text-primary">Fonctionnalités</h2>
            <p className="text-4xl md:text-5xl font-black tracking-tight">Tout ce dont vous avez besoin</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* CRM & Prospects */}
            <Card className="border-none shadow-xl hover:-translate-y-2 transition-transform duration-300">
              <CardHeader className="space-y-4">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl font-bold">CRM Omnicanal</CardTitle>
                <CardDescription className="text-lg">
                  Gestion complète des prospects avec timeline intégrée, historique des interactions et synchronisation multi-canal
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Voice AI */}
            <Card className="border-none shadow-xl hover:-translate-y-2 transition-transform duration-300">
              <CardHeader className="space-y-4">
                <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                  <Mic className="h-8 w-8 text-blue-500" />
                </div>
                <CardTitle className="text-2xl font-bold">Voice AI</CardTitle>
                <CardDescription className="text-lg">
                  Transcription temps réel, résumés IA automatiques et analyse de sentiment pour vos appels
                </CardDescription>
              </CardHeader>
            </Card>

            {/* AI Lead Scoring */}
            <Card className="border-none shadow-xl hover:-translate-y-2 transition-transform duration-300">
              <CardHeader className="space-y-4">
                <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center">
                  <Target className="h-8 w-8 text-purple-500" />
                </div>
                <CardTitle className="text-2xl font-bold">Lead Scoring IA</CardTitle>
                <CardDescription className="text-lg">
                  Scoring automatique 0-100 avec badges (Froid/Tiède/Chaud) basés sur interactions et engagement
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Automation Marketing */}
            <Card className="border-none shadow-xl hover:-translate-y-2 transition-transform duration-300">
              <CardHeader className="space-y-4">
                <div className="w-14 h-14 bg-orange-500/10 rounded-2xl flex items-center justify-center">
                  <Zap className="h-8 w-8 text-orange-500" />
                </div>
                <CardTitle className="text-2xl font-bold">Automation Marketing</CardTitle>
                <CardDescription className="text-lg">
                  Workflows d'automation, planification IA et génération de contenu pour emails, SMS et WhatsApp
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Recrutement IA */}
            <Card className="border-none shadow-xl hover:-translate-y-2 transition-transform duration-300">
              <CardHeader className="space-y-4">
                <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center">
                  <Briefcase className="h-8 w-8 text-green-500" />
                </div>
                <CardTitle className="text-2xl font-bold">Recrutement IA</CardTitle>
                <CardDescription className="text-lg">
                  Analyse CV, scoring candidats, simulations d'entretien et recommandations d'embauche automatiques
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Dashboard Analytics Pro */}
            <Card className="border-none shadow-xl hover:-translate-y-2 transition-transform duration-300">
              <CardHeader className="space-y-4">
                <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center">
                  <BarChart3 className="h-8 w-8 text-red-500" />
                </div>
                <CardTitle className="text-2xl font-bold">Dashboard Analytics</CardTitle>
                <CardDescription className="text-lg">
                  Métriques avancées, ROI en temps réel et rapports d'analytics personnalisés
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Social Media Manager */}
            <Card className="border-none shadow-xl hover:-translate-y-2 transition-transform duration-300">
              <CardHeader className="space-y-4">
                <div className="w-14 h-14 bg-pink-500/10 rounded-2xl flex items-center justify-center">
                  <MessageSquare className="h-8 w-8 text-pink-500" />
                </div>
                <CardTitle className="text-2xl font-bold">Social Media Manager</CardTitle>
                <CardDescription className="text-lg">
                  Gestion multi-réseaux, planification IA et génération d'images pour vos campagnes
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Workflows Avancés */}
            <Card className="border-none shadow-xl hover:-translate-y-2 transition-transform duration-300">
              <CardHeader className="space-y-4">
                <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center">
                  <RefreshCw className="h-8 w-8 text-indigo-500" />
                </div>
                <CardTitle className="text-2xl font-bold">Workflows Avancés</CardTitle>
                <CardDescription className="text-lg">
                  Workflows sans code, Kanban drag-and-drop et automation intelligente des processus
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Sécurité & Conformité */}
            <Card className="border-none shadow-xl hover:-translate-y-2 transition-transform duration-300">
              <CardHeader className="space-y-4">
                <div className="w-14 h-14 bg-cyan-500/10 rounded-2xl flex items-center justify-center">
                  <Lock className="h-8 w-8 text-cyan-500" />
                </div>
                <CardTitle className="text-2xl font-bold">Sécurité Enterprise</CardTitle>
                <CardDescription className="text-lg">
                  Multi-tenant SaaS, isolation des données, RGPD compliant et chiffrement end-to-end
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4 mb-20">
            <h2 className="text-sm font-black uppercase tracking-widest text-primary">Plans</h2>
            <p className="text-4xl md:text-5xl font-black tracking-tight">Tarification Transparente</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter Plan */}
            <Card className="border-2 border-muted hover:border-primary transition-colors">
              <CardHeader className="space-y-4">
                <CardTitle className="text-2xl">Starter</CardTitle>
                <div className="space-y-2">
                  <div className="text-4xl font-black">99€<span className="text-lg text-muted-foreground">/mois</span></div>
                  <p className="text-muted-foreground">Pour les petites équipes</p>
                </div>
              </CardHeader>
              <div className="px-6 pb-6 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span>CRM Omnicanal</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span>Workflows Basiques</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span>5 Agents</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span>1000 Appels/mois</span>
                </div>
                <Button className="w-full mt-6" variant="outline">Commencer</Button>
              </div>
            </Card>

            {/* Pro Plan */}
            <Card className="border-2 border-primary shadow-xl scale-105">
              <CardHeader className="space-y-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl">Pro</CardTitle>
                  <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">POPULAIRE</span>
                </div>
                <div className="space-y-2">
                  <div className="text-4xl font-black">299€<span className="text-lg text-muted-foreground">/mois</span></div>
                  <p className="text-muted-foreground">Pour les entreprises en croissance</p>
                </div>
              </CardHeader>
              <div className="px-6 pb-6 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span>Tout du plan Starter</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span>Voice AI + Transcription</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span>Lead Scoring IA</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span>Recrutement IA</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span>50 Agents</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span>10 000 Appels/mois</span>
                </div>
                <Button className="w-full mt-6">Commencer</Button>
              </div>
            </Card>

            {/* Enterprise Plan */}
            <Card className="border-2 border-muted hover:border-primary transition-colors">
              <CardHeader className="space-y-4">
                <CardTitle className="text-2xl">Enterprise</CardTitle>
                <div className="space-y-2">
                  <div className="text-4xl font-black">999€<span className="text-lg text-muted-foreground">/mois</span></div>
                  <p className="text-muted-foreground">Pour les grandes organisations</p>
                </div>
              </CardHeader>
              <div className="px-6 pb-6 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span>Tout du plan Pro</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span>Intégrations Personnalisées</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span>Support Dédié 24/7</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span>500 Agents</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span>100 000 Appels/mois</span>
                </div>
                <Button className="w-full mt-6" variant="outline">Contacter</Button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-black">Prêt à transformer votre business ?</h2>
          <p className="text-xl text-primary-foreground/80 max-w-2xl mx-auto">
            Rejoignez les entreprises qui utilisent Servicall pour automatiser leurs ventes et leur recrutement
          </p>
          <Button size="lg" variant="secondary" className="h-14 px-10 text-lg rounded-full" onClick={handleStart}>
            Commencer gratuitement
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="bg-primary p-2 rounded-xl">
                <Phone className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-black tracking-tighter">SERVICALL<span className="text-primary">.</span></span>
            </div>
            <div className="flex gap-8 text-sm text-muted-foreground">
              <button onClick={() => setLocation("/privacy")} className="hover:text-primary transition-colors cursor-pointer">Confidentialité</button>
              <button onClick={() => setLocation("/terms")} className="hover:text-primary transition-colors cursor-pointer">Conditions</button>
              <button onClick={() => setLocation("/contact")} className="hover:text-primary transition-colors cursor-pointer">Support</button>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 Servicall. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
