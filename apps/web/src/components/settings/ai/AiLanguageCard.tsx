import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "#components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "#components/ui/select";
import { Skeleton } from "#components/ui/skeleton";
import { api, toastError, toastSuccess } from "#lib/api";
import { m, locales, LOCALE_NAMES, type Locale } from "#lib/i18n";
import { localePrefsQuery } from "#lib/queries";

type AiLanguage = Locale | "auto";

/** Which language AI writes notes, summaries, suggestions and chat replies in. */
export function AiLanguageCard() {
  const queryClient = useQueryClient();
  const query = useQuery(localePrefsQuery);
  const value: AiLanguage | null = query.data?.aiLanguage ?? (query.isError ? "auto" : null);
  const setValue = (aiLanguage: AiLanguage | null) =>
    aiLanguage && queryClient.setQueryData(localePrefsQuery.queryKey, (d) => ({ ...d, aiLanguage }));

  async function change(next: AiLanguage) {
    const previous = value;
    setValue(next);
    try {
      await api("/api/settings/locale", { method: "PUT", json: { aiLanguage: next } });
      toastSuccess(m.ai_language_saved(), { id: "ai-language" });
    } catch (err) {
      setValue(previous);
      toastError(m.save_failed(), err, { id: "ai-language" });
    }
  }

  const items: Record<string, string> = {
    auto: m.ai_language_auto(),
    ...Object.fromEntries(locales.map((l) => [l, LOCALE_NAMES[l]])),
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.ai_language_title()}</CardTitle>
        <CardDescription>{m.ai_language_description()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {value === null ? (
          <Skeleton className="h-9 w-48 rounded-lg" />
        ) : (
          <Select value={value} items={items} onValueChange={(v) => v && change(v as AiLanguage)}>
            <SelectTrigger className="w-48 animate-fade-in">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {Object.entries(items).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        )}
        <p className="text-muted-foreground text-xs">{m.ai_cross_language_hint()}</p>
      </CardContent>
    </Card>
  );
}
