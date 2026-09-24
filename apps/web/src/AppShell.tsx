import { useEffect, useRef, useState } from "react";
import { Outlet, Link, NavLink, useLocation, useNavigate } from "react-router";
import { LogOutIcon } from "lucide-react";
import { useTheme } from "#hooks/useTheme";
import { ScrollFade } from "#components/ScrollFade";
import { Button } from "#components/ui/button";
import { BackToTop } from "#components/BackToTop";
import { CommandPalette } from "#components/CommandPalette";
import { HeaderMenu } from "#components/HeaderMenu";
import { LanguageMenu } from "#components/LanguageMenu";
import { ThemeToggle } from "#components/ThemeToggle";
import { syncLocaleWithServer } from "#lib/i18n";
import { cn } from "#lib/utils";
import { authClient } from "#lib/auth-client";
import { m } from "#lib/i18n";

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
  const { mode, nextMode, cycle, setMode } = useTheme();

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

  async function signOut() {
    await authClient.signOut();
    navigate("/login");
  }

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
          <div className="ml-auto flex shrink-0 items-center gap-1 max-sm:hidden">
            <LanguageMenu />
            <ThemeToggle mode={mode} nextMode={nextMode} onCycle={cycle} />
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOutIcon />
              {m.nav_sign_out()}
            </Button>
          </div>
          <div className="ml-auto shrink-0 sm:hidden">
            <HeaderMenu mode={mode} onModeChange={setMode} onSignOut={signOut} />
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
