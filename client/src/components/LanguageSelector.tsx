import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Languages, Check } from "lucide-react";

export function LanguageSelector() {
  const {i18n} = useTranslation('common');

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('i18nextLng', lng);
  };

  const currentLanguage = i18n.language || 'fr';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="flex items-center gap-2">
          <Languages className="w-4 h-4" />
          <span className="hidden md:inline">
            {currentLanguage === 'fr' ? 'Français' : 'English'}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem 
          onClick={() => changeLanguage('fr')}
          className="flex items-center justify-between"
        >
          <span>Français</span>
          {currentLanguage === 'fr' && <Check className="w-4 h-4" />}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => changeLanguage('en')}
          className="flex items-center justify-between"
        >
          <span>English</span>
          {currentLanguage === 'en' && <Check className="w-4 h-4" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
