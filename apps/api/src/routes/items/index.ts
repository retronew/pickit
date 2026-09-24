import { Hono } from "hono";
import type { Env } from "#types";
import { collectionRoutes } from "./collection";
import { ioRoutes } from "./io";
import { maintenanceRoutes } from "./maintenance";
import { bulkRoutes } from "./bulk";
import { aiRoutes } from "./ai";
import { itemByIdRoutes } from "./item";
import { orderRoutes } from "./order";
import { contentRoutes } from "./content";

export { itemsByIds, embedItem } from "./helpers";

// Order matters: static paths (/stats, /export, /duplicates…) must be
// registered before the catch-all /:id routes.
export const itemRoutes = new Hono<{ Bindings: Env }>()
  .route("/", collectionRoutes)
  .route("/", ioRoutes)
  .route("/", maintenanceRoutes)
  .route("/", bulkRoutes)
  .route("/", aiRoutes)
  .route("/", orderRoutes)
  .route("/", contentRoutes)
  .route("/", itemByIdRoutes);
