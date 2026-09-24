import { useEffect, useRef, useState } from "react";
import { Outlet, Link, NavLink, useLocation, useNavigate } from "react-router";
import { LogOutIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "#hooks/useTheme";
import { ScrollFade } from "#components/ScrollFade";
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
  const navRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { mode, nextMode, cycle } = useTheme();
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

  // On narrow screens the nav scrolls sideways; keep the current page in view.
  useEffect(() => {
    navRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname, authed]);

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

  const renderNavLinks = () =>
    navItems.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        end={"end" in item}
        className={({ isActive }) =>
          cn(
            "shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors",
            isActive
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          )
        }
      >
        {item.label}
      </NavLink>
    ));

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 md:gap-6">
          <Link to="/" className="shrink-0 font-heading font-bold tracking-tight">
            PickIt
          </Link>
          <ScrollFade as="nav" ref={navRef} className="-my-2 flex flex-1 gap-1 py-2 md:flex-none">
            {renderNavLinks()}
          </ScrollFade>
          <div className="ml-auto flex shrink-0 items-center gap-1">
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
              <TooltipPopup side="bottom">{m.theme_current({ mode: MODE_LABEL[mode] })}</TooltipPopup>
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
              <span className="max-sm:sr-only">{m.nav_sign_out()}</span>
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
