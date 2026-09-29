import { lazy, type ComponentType } from "react";

/** `React.lazy` for a page module that uses a named export. */
export function lazyPage<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(() => load().then((mod) => ({ default: mod[name] })));
}
