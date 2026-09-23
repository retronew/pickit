import { useEffect, useState } from "react";
import { Outlet, Link, NavLink, useNavigate } from "react-router";
import { LogOutIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "#hooks/useTheme";
import { Button } from "#components/ui/button";
import { Tooltip, TooltipTrigger, TooltipPopup } from "#components/ui/tooltip";
import { BackToTop } from "#components/BackToTop";
import { CommandPalette } from "#components/CommandPalette";
import { LanguageMenu } from "#components/LanguageMenu";
import { syncLocaleWithServer } from "#lib/i18n";
import { cn } from "#lib/utils";
import { authClient } from "#lib/auth-client";
import { m } from "#lib/i18n";

const MODE_LABEL = {
  system: m.theme_system(),
  light: m.theme_light(),
  dark: m.theme_dark(),
} as const;
const MODE_ICON = { system: MonitorIcon, light: SunIcon, dark: MoonIcon } as const;

/** Login URL that returns here afterwards, e.g. to /add from the bookmarklet. */
function loginUrl() {
  const here = window.location.pathname + window.location.search;
  return here === "/" ? "/login" : `/login?redirect=${encodeURIComponent(here)}`;
}

export function AppShell() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { mode, theme, nextMode, cycle } = useTheme();
  const ModeIcon = MODE_ICON[mode];

  useEffect(() => {
    // The API also enforces the email allowlist; a session alone isn't enough.
    fetch("/api/me")
      .then((r) => {
        setAuthed(r.ok);
        if (!r.ok) navigate(loginUrl());
        else syncLocaleWithServer();
      })
      .catch(() => navigate(loginUrl()));
  }, [navigate]);

  // Render nothing until the session is confirmed, so pages never fetch unauthenticated.
  if (authed !== true) return null;

  const navItems = [
    { to: "/", label: m.nav_items(), end: true },
    { to: "/tags", label: m.nav_tags() },
    { to: "/stats", label: m.nav_stats() },
    { to: "/trash", label: m.nav_trash() },
    { to: "/audit", label: m.nav_audit() },
    { to: "/settings", label: m.nav_settings() },
  ];

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
          <Link to="/" className="font-heading font-bold tracking-tight">
            PickIt
          </Link>
          <nav className="flex gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={"end" in item}
                className={({ isActive }) =>
                  cn(
                    "rounded-lg px-3 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <LanguageMenu />
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => cycle({ x: e.clientX, y: e.clientY })}
                    aria-label={m.theme_aria({ mode: MODE_LABEL[mode], next: MODE_LABEL[nextMode] })}
                  />
                }
              >
                <ModeIcon />
              </TooltipTrigger>
              <TooltipPopup side="bottom">
                {m.theme_current({ mode: MODE_LABEL[mode] })}
                {mode === "system" && m.theme_resolved({ theme: MODE_LABEL[theme] })}
                <span className="text-muted-foreground">
                  {" · "}{m.theme_next({ next: MODE_LABEL[nextMode] })}
                </span>
              </TooltipPopup>
            </Tooltip>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await authClient.signOut();
                navigate("/login");
              }}
            >
              <LogOutIcon />
              {m.nav_sign_out()}
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <BackToTop />
      <CommandPalette />
    </div>
  );
}
