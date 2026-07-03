import React from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import Dashboard from "./pages/Dashboard";
import PageView from "./pages/PageView";
import ObjectManager from "./pages/ObjectManager";
import ModelingWorkshop from "./pages/ModelingWorkshop";
import PageDesigner from "./pages/PageDesigner";
import ProcessDesigner from "./pages/ProcessDesigner";
import DialogueChat from "./pages/DialogueChat";
import CapabilityCenter from "./pages/CapabilityCenter";
import IntegrationHub from "./pages/IntegrationHub";
import AppMarket from "./pages/AppMarket";
import BillingDashboard from "./pages/BillingDashboard";
import AdminPanel from "./pages/AdminPanel";
import TicketSystem from "./pages/TicketSystem";
import PlatformConfig from "./pages/PlatformConfig";
import "./index.css";
import "./App.css";

const navItems = [
  { to: "/", label: "页面配置", end: true },
  { to: "/objects", label: "ObjectType" },
  { to: "/workshop", label: "建模特工场" },
  { to: "/designer", label: "设计器" },
  { to: "/process-designer", label: "流程设计器" },
  { to: "/dialogue", label: "AI 对话" },
  { to: "/capabilities", label: "能力中心" },
  { to: "/integration", label: "集成中心" },
  { to: "/market", label: "应用市场" },
  { to: "/billing", label: "计费中心" },
  { to: "/admin", label: "平台管理" },
  { to: "/tickets", label: "工单系统" },
  { to: "/config", label: "平台配置" },
];

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border shrink-0">
          {/* Brand */}
          <div className="flex items-center gap-2 px-4 py-4 border-b border-sidebar-border">
            <span className="flex items-center justify-center w-8 h-8 rounded-md bg-primary text-primary-foreground font-bold text-lg">
              M
            </span>
            <span className="font-semibold text-base text-sidebar-foreground">
              MetaPlatform
            </span>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1">
            <nav className="flex flex-col gap-1 p-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </ScrollArea>

          <Separator className="bg-sidebar-border" />
          <div className="px-4 py-3 text-xs text-sidebar-foreground/50">
            v0.1.0
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto bg-background">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pages/:id" element={<PageView />} />
            <Route path="/objects" element={<ObjectManager />} />
            <Route path="/workshop" element={<ModelingWorkshop />} />
            <Route path="/designer" element={<PageDesigner />} />
            <Route path="/designer/:id" element={<PageDesigner />} />
            <Route path="/process-designer" element={<ProcessDesigner />} />
            <Route path="/dialogue" element={<DialogueChat />} />
            <Route path="/capabilities" element={<CapabilityCenter />} />
            <Route path="/integration" element={<IntegrationHub />} />
            <Route path="/market" element={<AppMarket />} />
            <Route path="/billing" element={<BillingDashboard />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/tickets" element={<TicketSystem />} />
            <Route path="/config" element={<PlatformConfig />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;
