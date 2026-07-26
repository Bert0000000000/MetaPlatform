import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SuperAIChatPage from './pages/SuperAIChatPage';
import AgentCopilotPage from './pages/AgentCopilotPage';
import StorybookDemo from './components/__demo__/StorybookDemo';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="/chat" element={<SuperAIChatPage />} />
        <Route path="/agent-copilot" element={<AgentCopilotPage />} />
        <Route path="/agent-copilot/:concept/:objectId" element={<AgentCopilotPage />} />
        <Route path="/__storybook" element={<StorybookDemo />} />
      </Routes>
    </BrowserRouter>
  );
}
