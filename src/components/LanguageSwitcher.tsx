import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LOCALE_LABELS, SUPPORTED_LOCALES, isLocale, setLocale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export function LanguageSwitcher({ className }: { className?: string }) {
  const { t, i18n } = useTranslation()
  const current = isLocale(i18n.resolvedLanguage) ? i18n.resolvedLanguage : 'en'

  return (
    <Select value={current} onValueChange={(value) => isLocale(value) && void setLocale(value)}>
      <SelectTrigger
        aria-label={t('language.label')}
        // min-h-11 not h-11: the label wraps in Bahasa Indonesia at 320px.
        className={cn('min-h-11 gap-2', className)}
      >
        <Languages aria-hidden="true" className="size-4 shrink-0 opacity-70" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LOCALES.map((locale) => (
          // lang= on each option so a screen reader switches voice per entry
          // and Han glyphs render in the right regional form.
          <SelectItem key={locale} value={locale} lang={locale}>
            {LOCALE_LABELS[locale]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default LanguageSwitcher
