import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import TradePulse from "@/App";
import { AuthProvider } from "@/data/auth";
import { Gate } from "@/features/auth/Gate";
import "@/index.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root missing from index.html");

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <Gate>
        <TradePulse />
      </Gate>
    </AuthProvider>
  </StrictMode>,
);
