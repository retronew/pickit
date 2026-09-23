import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import "./index.css";
import { AppShell } from "#AppShell";
import { ItemsPage } from "#pages/ItemsPage";
import { AddPage } from "#pages/AddPage";
import { TrashPage } from "#pages/TrashPage";
import { TagsPage } from "#pages/TagsPage";
import { StatsPage } from "#pages/StatsPage";
import { SettingsPage } from "#pages/SettingsPage";
import { LoginPage } from "#pages/LoginPage";
import { PublicSharePage } from "#pages/PublicSharePage";
import { ToastProvider } from "#components/ui/toast";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider position="top-center">
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/s/:slug" element={<PublicSharePage />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<ItemsPage />} />
          <Route path="/add" element={<AddPage />} />
          <Route path="/trash" element={<TrashPage />} />
          <Route path="/tags" element={<TagsPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  </StrictMode>,
);
