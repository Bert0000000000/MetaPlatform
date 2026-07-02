import React from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import PageView from "./pages/PageView";
import ObjectManager from "./pages/ObjectManager";
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
          </nav>
        </aside>

        {/* Main content */}
        <main className="mp-main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pages/:id" element={<PageView />} />
            <Route path="/objects" element={<ObjectManager />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;
