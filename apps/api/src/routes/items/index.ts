import { Hono } from "hono";
import type { Env } from "#types";
import { collectionRoutes } from "./collection";
import { ioRoutes } from "./io";
import { maintenanceRoutes } from "./maintenance";
import { aiRoutes } from "./ai";
import { itemByIdRoutes } from "./item";

export { itemsByIds, embedItem } from "./helpers";

// Order matters: static paths (/stats, /export, /duplicates…) must be
// registered before the catch-all /:id routes.
export const itemRoutes = new Hono<{ Bindings: Env }>()
  .route("/", collectionRoutes)
  .route("/", ioRoutes)
  .route("/", maintenanceRoutes)
  .route("/", aiRoutes)
  .route("/", itemByIdRoutes);
