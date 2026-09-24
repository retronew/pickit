import type { ThemeMode } from "#hooks/useTheme";
import { Button } from "#components/ui/button";
import { Tooltip, TooltipTrigger, TooltipPopup } from "#components/ui/tooltip";
import { THEME_MODE_ICON, THEME_MODE_LABEL } from "#lib/theme-labels";
import { m } from "#lib/i18n";

/** Header button that cycles the theme mode, revealed from the click point. */
export function ThemeToggle({
  mode,
  nextMode,
  onCycle,
}: {
  mode: ThemeMode;
  nextMode: ThemeMode;
  onCycle: (origin: { x: number; y: number }) => void;
}) {
  const Icon = THEME_MODE_ICON[mode];
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => onCycle({ x: e.clientX, y: e.clientY })}
            aria-label={m.theme_aria({ mode: THEME_MODE_LABEL[mode], next: THEME_MODE_LABEL[nextMode] })}
          />
        }
      >
        <Icon />
      </TooltipTrigger>
      <TooltipPopup side="bottom">{m.theme_current({ mode: THEME_MODE_LABEL[mode] })}</TooltipPopup>
    </Tooltip>
  );
}
