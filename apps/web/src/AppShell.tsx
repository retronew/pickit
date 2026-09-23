import { useEffect, useState } from "react";
import { Outlet, Link, NavLink, useNavigate } from "react-router";
import { LogOutIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "#hooks/useTheme";
import { Button } from "#components/ui/button";
import { BackToTop } from "#components/BackToTop";
import { CommandPalette } from "#components/CommandPalette";
import { cn } from "#lib/utils";

export function AppShell() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((d) => {
        setAuthed(d.authenticated);
        if (!d.authenticated) navigate("/login");
      })
      .catch(() => navigate("/login"));
  }, [navigate]);

  if (authed === false) return null;

  const navItems = [
    { to: "/", label: "收藏", end: true },
    { to: "/tags", label: "标签" },
    { to: "/stats", label: "统计" },
    { to: "/trash", label: "回收站" },
    { to: "/settings", label: "设置" },
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
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => toggle({ x: e.clientX, y: e.clientY })}
              aria-label="切换主题"
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                navigate("/login");
              }}
            >
              <LogOutIcon />
              退出
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
