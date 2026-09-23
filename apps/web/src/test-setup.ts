import { overwriteGetLocale } from "@pickit/shared/i18n";

// Node exposes navigator.language ("en-US"); pin tests to the base locale.
overwriteGetLocale(() => "zh");
