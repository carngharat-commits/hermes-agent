/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { Brain, Briefcase, Calendar, ClipboardList, Cpu, Gauge, LayoutDashboard, Settings, ShieldAlert, Target, TrendingUp, Users } from "lucide-react";

export const NAV = [
  { k: "dashboard",     l: "Dashboard",       ic: LayoutDashboard,  group: "Home" },
  { k: "intelligence",  l: "Intelligence",    ic: Brain,            group: "Home", badge: "3 new" },
  { k: "portfolio",     l: "Portfolio",       ic: Briefcase,        group: "Investing" },
  { k: "signals",       l: "Signals",         ic: Target,           group: "Investing" },
  { k: "opportunities", l: "Opportunities",   ic: TrendingUp,       group: "Investing" },
  { k: "calendar",      l: "Calendar",        ic: Calendar,         group: "Investing" },
  { k: "risk",          l: "Risk Audit",      ic: ShieldAlert,      group: "Advisor" },
  { k: "performance",   l: "AI Performance",  ic: Gauge,            group: "Advisor" },
  { k: "orders",        l: "Orders",          ic: ClipboardList,    group: "Trading" },
  { k: "algo",          l: "Algo",            ic: Cpu,              group: "Trading" },
  { k: "accounts",      l: "Accounts",        ic: Users,            group: "Settings" },
  { k: "settings",      l: "Settings",        ic: Settings,         group: "Settings" },
];

export const NAV_GROUPS = ["Home", "Investing", "Advisor", "Trading", "Settings"];
