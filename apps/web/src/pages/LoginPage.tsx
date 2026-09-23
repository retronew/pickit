import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "#components/ui/card";
import { Button } from "#components/ui/button";
import { authClient } from "#lib/auth-client";
import { m } from "#lib/i18n";

type Provider = "google" | "github";

const PROVIDERS: Record<Provider, { label: () => string; icon: React.ReactNode }> = {
  google: {
    label: () => m.login_with({ provider: "Google" }),
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24Z" />
        <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9l4-3.1Z" />
        <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
      </svg>
    ),
  },
  github: {
    label: () => m.login_with({ provider: "GitHub" }),
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
        <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z" />
      </svg>
    ),
  },
};

const ERRORS: Record<string, () => string> = {
  email_not_allowed: () => m.login_error_not_allowed(),
  access_denied: () => m.login_error_denied(),
  unable_to_get_user_info: () => m.login_error_no_email(),
};

export function LoginPage() {
  const [params] = useSearchParams();
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/public/auth-providers")
      .then((r) => r.json())
      .then((d: { providers: Provider[] }) => setProviders(d.providers))
      .catch(() => setProviders([]));
  }, []);

  const code = params.get("error");
  // Same-origin paths only, so the redirect can't send you to another site.
  const redirect = params.get("redirect") ?? "";
  const callbackURL = /^\/(?![/\\])/.test(redirect) ? redirect : "/";
  const message = error || (code ? (ERRORS[code]?.() ?? m.login_error_code({ code })) : "");

  async function signIn(provider: Provider) {
    setPending(provider);
    setError("");
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL,
      errorCallbackURL: callbackURL === "/" ? "/login" : `/login?redirect=${encodeURIComponent(callbackURL)}`,
    });
    // On success the browser is already being redirected to the provider.
    if (error) {
      setPending(null);
      setError(error.message ?? m.login_error_generic());
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">PickIt</CardTitle>
          <CardDescription>{m.login_description()}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {providers?.map((p) => (
            <Button
              key={p}
              size="lg"
              variant="outline"
              className="w-full"
              disabled={pending !== null}
              onClick={() => signIn(p)}
            >
              {PROVIDERS[p].icon}
              {pending === p ? m.login_redirecting() : PROVIDERS[p].label()}
            </Button>
          ))}
          {providers?.length === 0 && (
            <p className="text-muted-foreground text-sm">
              {m.login_no_providers()}
            </p>
          )}
          {message && <p className="text-destructive-foreground text-sm">{message}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
