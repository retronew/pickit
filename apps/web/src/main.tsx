import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import "./index.css";
import { AppShell } from "#AppShell";
import { ItemsPage } from "#pages/ItemsPage";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { ToastProvider } from "#components/ui/toast";
import { persistOptions, queryClient } from "#lib/query-client";
import { applyDocumentLocale } from "#lib/i18n";
import { registerServiceWorker } from "#lib/pwa";
import { lazyPage } from "#lib/lazyPage";
import { PageLoading } from "#components/PageLoading";

// The home page ships in the main bundle; every other page loads on demand.
const AddPage = lazyPage(() => import("#pages/AddPage"), "AddPage");
const TrashPage = lazyPage(() => import("#pages/TrashPage"), "TrashPage");
const TagsPage = lazyPage(() => import("#pages/TagsPage"), "TagsPage");
const CategoriesPage = lazyPage(() => import("#pages/CategoriesPage"), "CategoriesPage");
const StatsPage = lazyPage(() => import("#pages/StatsPage"), "StatsPage");
const SettingsPage = lazyPage(() => import("#pages/SettingsPage"), "SettingsPage");
const SharesPage = lazyPage(() => import("#pages/SharesPage"), "SharesPage");
const AuditPage = lazyPage(() => import("#pages/AuditPage"), "AuditPage");
const LoginPage = lazyPage(() => import("#pages/LoginPage"), "LoginPage");
const PublicSharePage = lazyPage(() => import("#pages/PublicSharePage"), "PublicSharePage");

applyDocumentLocale();
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
    <ToastProvider position="top-center">
    <BrowserRouter>
      <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/s/:slug" element={<PublicSharePage />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<ItemsPage />} />
          <Route path="/add" element={<AddPage />} />
          <Route path="/trash" element={<TrashPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/tags" element={<TagsPage />} />
          <Route path="/shares" element={<SharesPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
      </Suspense>
    </BrowserRouter>
    </ToastProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
);
