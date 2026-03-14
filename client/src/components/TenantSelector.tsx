import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

export function TenantSelector() {
  const { t } = useTranslation(['common']);
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const {data: tenants} = trpc.auth.myTenants.useQuery();

  if (!user || !tenants || tenants.length === 0) {
    return null;
  }

  const currentTenantId = new URLSearchParams(window.location.search).get(
    "tenantId"
  );

  const handleTenantChange = (tenantId: string) => {
    // Le backend attend un number, mais l'URL et le composant Select utilisent des strings
    setLocation(`/dashboard?tenantId=${tenantId}`);
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={currentTenantId || ""} onValueChange={handleTenantChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder={t('common:placeholders.select_workspace', 'Sélectionner un espace de travail')} />
        </SelectTrigger>
        <SelectContent>
          {tenants
            
            .map((item: any) => (
              <SelectItem key={item.id} value={item.id.toString()}>
                <div className="flex items-center gap-2">
                  {item.logo && (
                    <img
                      src={item.logo}
                      alt={item.name}
                      className="w-4 h-4 rounded"
                    />
                  )}
                  <span>{item.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({item.role})
                  </span>
                </div>
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}
