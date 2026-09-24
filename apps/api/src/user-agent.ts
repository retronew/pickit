// Browser, system and device kind of a visit, parsed by bowser.

import Bowser from "bowser";
import type { DeviceKind } from "@pickit/shared";

export interface ParsedUserAgent {
  browser: string;
  os: string;
  device: DeviceKind;
}

const DEVICES: Record<string, DeviceKind> = { desktop: "desktop", mobile: "mobile", tablet: "tablet" };

export function parseUserAgent(ua: string): ParsedUserAgent {
  if (!ua) return { browser: "", os: "", device: "" };
  const { browser, os, platform } = Bowser.parse(ua);
  return { browser: browser.name ?? "", os: os.name ?? "", device: DEVICES[platform.type ?? ""] ?? "" };
}
