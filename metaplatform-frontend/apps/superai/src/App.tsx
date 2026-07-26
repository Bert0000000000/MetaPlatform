import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SuperAIChatPage from './pages/SuperAIChatPage';
import AgentCopilotPage from './pages/AgentCopilotPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="/chat" element={<SuperAIChatPage />} />
        <Route path="/agent-copilot" element={<AgentCopilotPage />} />
        <Route path="/agent-copilot/:concept/:objectId" element={<AgentCopilotPage />} />
      </Routes>
    </BrowserRouter>
  );
}
