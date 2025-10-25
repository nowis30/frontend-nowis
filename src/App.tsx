import { Routes, Route, Navigate } from 'react-router-dom';

import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import DashboardScreen from './screens/Dashboard';
import InvoicesScreen from './screens/Invoices';
import LoginScreen from './screens/Login';
import PropertiesScreen from './screens/Properties';
import ExpensesScreen from './screens/Expenses';
import RevenuesScreen from './screens/Revenues';
import CompaniesScreen from './screens/Companies';
import TeamScreen from './screens/Team';
import ReportsScreen from './screens/Reports';
import AdvisorsScreen from './screens/Advisors';
import AdvisorPortalPage from './screens/AdvisorPortal';
import SpecialistSession from './screens/SpecialistSession';
import MobileUploadScreen from './screens/MobileUpload';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/advisor-portal" element={<AdvisorPortalPage />} />
      <Route path="/advisor" element={<Navigate to="/advisor-portal" replace />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardScreen />} />
        <Route path="/properties" element={<PropertiesScreen />} />
        <Route path="/companies" element={<CompaniesScreen />} />
        <Route path="/team" element={<TeamScreen />} />
        <Route path="/reports" element={<ReportsScreen />} />
        <Route path="/advisors" element={<AdvisorsScreen />} />
        <Route path="/session" element={<SpecialistSession />} />
        <Route path="/invoices" element={<InvoicesScreen />} />
        <Route path="/revenues" element={<RevenuesScreen />} />
        <Route path="/expenses" element={<ExpensesScreen />} />
      </Route>
      <Route
        path="/mobile-upload"
        element={
          <ProtectedRoute>
            <MobileUploadScreen />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
