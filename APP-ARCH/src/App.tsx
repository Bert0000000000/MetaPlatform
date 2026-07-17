import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import LoginPage from '@/pages/LoginPage';
import BusinessArchPage from '@/pages/BusinessArchPage';
import CapabilityManagementPage from '@/pages/CapabilityManagementPage';
import ApplicationManagementPage from '@/pages/ApplicationManagementPage';
import ValueStreamPage from '@/pages/ValueStreamPage';
import BusinessProcessPage from '@/pages/BusinessProcessPage';
import OrgRolePage from '@/pages/OrgRolePage';
import DataArchPage from '@/pages/DataArchPage';
import TechArchPage from '@/pages/TechArchPage';
import PrinciplesPage from '@/pages/PrinciplesPage';
import ReviewPage from '@/pages/ReviewPage';
import TechDebtPage from '@/pages/TechDebtPage';
import OntologyMappingPage from '@/pages/OntologyMappingPage';
import { isLoggedIn } from '@/utils/auth';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/arch" replace />} />
          <Route path="arch" element={<BusinessArchPage />} />
          <Route path="arch/capabilities" element={<CapabilityManagementPage />} />
          <Route path="arch/applications" element={<ApplicationManagementPage />} />
          <Route path="arch/value-streams" element={<ValueStreamPage />} />
          <Route path="arch/processes" element={<BusinessProcessPage />} />
          <Route path="arch/org-roles" element={<OrgRolePage />} />
          <Route path="arch/data" element={<DataArchPage />} />
          <Route path="arch/tech" element={<TechArchPage />} />
          <Route path="arch/principles" element={<PrinciplesPage />} />
          <Route path="arch/reviews" element={<ReviewPage />} />
          <Route path="arch/tech-debt" element={<TechDebtPage />} />
          <Route path="arch/ontology-mapping" element={<OntologyMappingPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
