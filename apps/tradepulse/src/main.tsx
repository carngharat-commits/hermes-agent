import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import TradePulse from "@/App";
import "@/index.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root missing from index.html");

createRoot(root).render(
  <StrictMode>
    <TradePulse />
  </StrictMode>,
);
