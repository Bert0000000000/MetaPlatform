import React from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import PageView from "./pages/PageView";
import ObjectManager from "./pages/ObjectManager";
import ModelingWorkshop from "./pages/ModelingWorkshop";
import PageDesigner from "./pages/PageDesigner";
import ProcessDesigner from "./pages/ProcessDesigner";
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
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;
