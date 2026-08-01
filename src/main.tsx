import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
// Side effect: initialises i18next and starts tracking <html lang>.
import "./lib/i18n";
import { DEMO_MODE } from "./lib/demo";
import DemoBanner from "./lib/demo/DemoBanner";
import { queryClient } from "./lib/queryClient";

// ---------------------------------------------------------------------------
// One-time cleanup of the pre-rebuild Zustand `persist` keys.
//
// Those stores wrote their mock literals to localStorage on first render, with
// no `version` and no `migrate`. Deleting the mock arrays from source is not
// enough: rehydration puts Sakura Studios and Rp 2.500.000.000 back into the
// owner's own browser forever, and criterion 1 gets marked done while the screen
// still lies. Removing the keys is the only fix that reaches an existing tab.
//
// Safe to run every boot — after the stores are gone these are no-ops. Delete
// this block once the owner has loaded the app at least once post-Wave-5.
// ---------------------------------------------------------------------------
for (const key of [
  "circle-store",
  "ticket-store",
  "financial-store",
  "doujindesk-staff-store",
  "event-store",
]) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* private mode / storage disabled — nothing to clean up anyway */
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {/* Rendered only in demo mode, so the role picker is not wired otherwise. */}
      {DEMO_MODE && <DemoBanner />}
    </QueryClientProvider>
  </StrictMode>
);
