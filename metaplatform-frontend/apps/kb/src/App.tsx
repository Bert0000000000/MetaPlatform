import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import KbListPage from './pages/KbListPage';
import SearchTestPage from './pages/SearchTestPage';

/**
 * KB 前端应用入口（P2.3）。
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/kbs" replace />} />
        <Route path="/kbs" element={<KbListPage />} />
        <Route path="/search" element={<SearchTestPage />} />
      </Routes>
    </BrowserRouter>
  );
}
