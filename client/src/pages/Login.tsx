import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, AlertCircle, Shield, Zap, MessageSquare } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
// ✅ CORRECTION BUG CSRF: Import de refreshCsrfToken pour rafraîchir le token après login
import { refreshCsrfToken } from "@/hooks/useCsrfToken";

const baseLoginSchema = z.object({
  email: z.string(),
  password: z.string(),
});
type LoginFormValues = z.infer<typeof baseLoginSchema>;

export default function Login() {
  const { t } = useTranslation('common');
  
  const loginSchema = z.object({
    email: z.string()
      .min(1, t("auth.email_required"))
      .email(t("auth.invalid_email")),
    password: z.string()
      .min(1, t("auth.password_required"))
      .min(6, t("auth.password_too_short")),
  });

  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });
  
  const utils = trpc.useUtils();
  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      if (data.user) {
        utils.auth.me.setData(undefined, data.user as any);
      }
      toast.success(t("auth.login_success"));

      // ✅ CORRECTION CRITIQUE BUG CSRF POST-LOGIN
      // Après le login, le cookie de session change (nouveau token JWT).
      // L'ancien token CSRF est lié à l'ancienne session et devient invalide.
      // On doit :
      // 1. Rafraîchir le token CSRF (lié à la nouvelle session)
      // 2. Vider le cache React Query (pour éviter des requêtes avec l'ancien contexte)
      // 3. Naviguer vers le dashboard
      try {
        // Attendre un court instant pour s'assurer que le cookie de session est bien défini
        await new Promise(resolve => setTimeout(resolve, 200)); // 200ms de délai
        await refreshCsrfToken();
      } catch (e) {
        console.warn("[Login] Impossible de rafraîchir le CSRF token, navigation forcée", e);
      }

      // Vider le cache React Query pour forcer un rechargement propre
      // Invalider le cache React Query après un court délai pour s'assurer que le nouveau contexte est pris en compte
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms de délai
      utils.auth.me.invalidate();

      // Navigation vers le dashboard (après rafraîchissement CSRF)
      setLocation("/dashboard");
    },
    onError: (err) => {
      const errorMessage = err.message || t("auth.login_error");
      setError(errorMessage);
      toast.error(errorMessage);
    }
  });

  const onSubmit = (values: LoginFormValues) => {
    setError(null);
    loginMutation.mutate(values);
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel - Information & Branding (Visible on large screens) */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden items-center justify-center p-12">
        {/* Decorative background elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-400 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-lg text-primary-foreground space-y-8">
          <div className="flex items-center gap-3 mb-12">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
              <Phone className="h-10 w-10 text-white" />
            </div>
            <span className="text-3xl font-bold tracking-tight">{t('app_name')} CRM</span>
          </div>

          <div className="space-y-6">
            <h1 className="text-4xl font-extrabold leading-tight">
              {t('auth.branding_title')}
            </h1>
            <p className="text-xl text-primary-foreground/80 leading-relaxed">
              {t('auth.branding_desc')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 pt-8">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-white/10 rounded-lg">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{t('auth.feature_speed_title')}</h3>
                <p className="text-primary-foreground/70">{t('auth.feature_speed_desc')}</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-2 bg-white/10 rounded-lg">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{t('auth.feature_security_title')}</h3>
                <p className="text-primary-foreground/70">{t('auth.feature_security_desc')}</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-2 bg-white/10 rounded-lg">
                <MessageSquare className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{t('auth.feature_ai_title')}</h3>
                <p className="text-primary-foreground/70">{t('auth.feature_ai_desc')}</p>
              </div>
            </div>
          </div>

          <div className="pt-12 border-t border-white/20">
            <p className="text-sm text-primary-foreground/60 italic">
              {t('auth.testimonial')}
            </p>
            <p className="mt-2 font-medium text-white">— {t('auth.testimonial_author')}</p>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 md:p-16 lg:p-24 bg-muted/10">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left space-y-2">
            <div className="lg:hidden flex justify-center mb-6">
               <div className="p-3 bg-primary/10 rounded-2xl">
                <Phone className="h-10 w-10 text-primary" />
              </div>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">{t('auth.login_title')}</h2>
            <p className="text-muted-foreground">
              {t('auth.login_description')}
            </p>
          </div>

          <div className="flex p-1 bg-muted rounded-lg mb-8">
            <Button variant="ghost" className="w-1/2 rounded-md bg-background shadow-sm">{t('nav.login')}</Button>
            {/* ✅ CORRECTION BUG SIGNUP: Navigation vers la vraie page /signup */}
            <Button variant="ghost" className="w-1/2 rounded-md" onClick={() => setLocation("/signup")}>{t('nav.signup')}</Button>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {error && (
                <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground/80">{t('auth.email')}</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder={t('auth.email_placeholder')} 
                          className="h-12 bg-background border-muted-foreground/20 focus:border-primary focus:ring-primary"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-foreground/80">{t('auth.password')}</FormLabel>
                        <button 
                          type="button"
                          className="text-sm font-medium text-primary hover:underline"
                          onClick={() => toast.info(t("auth.forgot_password_info"))}
                        >
                          {t('auth.forgot_password')}
                        </button>
                      </div>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="••••••••"
                          className="h-12 bg-background border-muted-foreground/20 focus:border-primary focus:ring-primary"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input type="checkbox" id="remember" className="rounded border-muted-foreground/30 text-primary focus:ring-primary h-4 w-4" />
                <label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">{t('auth.remember_me')}</label>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-lg font-semibold shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99]" 
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {t('auth.logging_in')}
                  </div>
                ) : t('auth.login_button')}
              </Button>
            </form>
          </Form>

          <div className="pt-8 text-center border-t border-muted">
            <p className="text-sm text-muted-foreground">
              {t('auth.footer_copyright')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
