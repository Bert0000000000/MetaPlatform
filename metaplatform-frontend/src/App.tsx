import React from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
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
import "./App.css";

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="mp-app">
        {/* Sidebar */}
        <aside className="mp-sidebar">
          <div className="mp-sidebar-brand">
            <span className="mp-brand-icon">M</span>
            <span className="mp-brand-text">MetaPlatform</span>
          </div>
          <nav className="mp-sidebar-nav">
            <NavLink
              to="/"
              end
              className={({ isActive }) => (isActive ? "mp-nav-link active" : "mp-nav-link")}
            >
              页面配置
            </NavLink>
            <NavLink
              to="/objects"
              className={({ isActive }) => (isActive ? "mp-nav-link active" : "mp-nav-link")}
            >
              ObjectType
            </NavLink>
            <NavLink
              to="/workshop"
              className={({ isActive }) => (isActive ? "mp-nav-link active" : "mp-nav-link")}
            >
              建模特工场
            </NavLink>
            <NavLink
              to="/designer"
              className={({ isActive }) => (isActive ? "mp-nav-link active" : "mp-nav-link")}
            >
              设计器
            </NavLink>
            <NavLink
              to="/process-designer"
              className={({ isActive }) => (isActive ? "mp-nav-link active" : "mp-nav-link")}
            >
              流程设计器
            </NavLink>
            <NavLink
              to="/dialogue"
              className={({ isActive }) => (isActive ? "mp-nav-link active" : "mp-nav-link")}
            >
              AI 对话
            </NavLink>
            <NavLink
              to="/capabilities"
              className={({ isActive }) => (isActive ? "mp-nav-link active" : "mp-nav-link")}
            >
              能力中心
            </NavLink>
            <NavLink
              to="/integration"
              className={({ isActive }) => (isActive ? "mp-nav-link active" : "mp-nav-link")}
            >
              集成中心
            </NavLink>
            <NavLink
              to="/market"
              className={({ isActive }) => (isActive ? "mp-nav-link active" : "mp-nav-link")}
            >
              应用市场
            </NavLink>
          </nav>
        </aside>

        {/* Main content */}
        <main className="mp-main">
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
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;
