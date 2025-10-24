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

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<LoginScreen />} />
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
        <Route path="/invoices" element={<InvoicesScreen />} />
        <Route path="/revenues" element={<RevenuesScreen />} />
        <Route path="/expenses" element={<ExpensesScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
