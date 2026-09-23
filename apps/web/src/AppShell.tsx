import { useEffect, useState } from "react";
import { Outlet, Link, NavLink, useNavigate } from "react-router";
import { LogOutIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "#hooks/useTheme";
import { Button } from "#components/ui/button";
import { Tooltip, TooltipTrigger, TooltipPopup } from "#components/ui/tooltip";
import { BackToTop } from "#components/BackToTop";
import { CommandPalette } from "#components/CommandPalette";
import { cn } from "#lib/utils";
import { authClient } from "#lib/auth-client";

const MODE_LABEL = { system: "跟随系统", light: "浅色", dark: "深色" } as const;
const MODE_ICON = { system: MonitorIcon, light: SunIcon, dark: MoonIcon } as const;

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
        if (!r.ok) navigate("/login");
      })
      .catch(() => navigate("/login"));
  }, [navigate]);

  // Render nothing until the session is confirmed, so pages never fetch unauthenticated.
  if (authed !== true) return null;

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
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => cycle({ x: e.clientX, y: e.clientY })}
                    aria-label={`主题：${MODE_LABEL[mode]}，点击切换为${MODE_LABEL[nextMode]}`}
                  />
                }
              >
                <ModeIcon />
              </TooltipTrigger>
              <TooltipPopup side="bottom">
                主题：{MODE_LABEL[mode]}
                {mode === "system" && `（当前${MODE_LABEL[theme]}）`}
                <span className="text-muted-foreground">
                  {" · "}点击切换为{MODE_LABEL[nextMode]}
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
