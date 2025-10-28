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
import LeveragedBuybackScreen from './screens/LeveragedBuyback';
import LeverageScreen from './screens/Leverage';
import AdvisorsScreen from './screens/Advisors';
import AdvisorPortalPage from './screens/AdvisorPortal';
import SpecialistSession from './screens/SpecialistSession';
import MobileUploadScreen from './screens/MobileUpload';
import RentalTaxScreen from './screens/RentalTax';
import ValuationScreen from './screens/Valuation';
import PersonalIncomeScreen from './screens/PersonalIncome';
import FamilyWealthScreen from './screens/FamilyWealth';
import FreezeSimulationScreen from './screens/FreezeSimulation';
import CorporateDividendsScreen from './screens/CorporateDividends';
import CorporateROCScreen from './screens/CorporateROC';
import TaxExportsScreen from './screens/TaxExports';

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
        <Route path="/valuation" element={<ValuationScreen />} />
  <Route path="/leveraged-buyback" element={<LeveragedBuybackScreen />} />
  <Route path="/leverage" element={<LeverageScreen />} />
        <Route path="/advisors" element={<AdvisorsScreen />} />
    <Route path="/rental-tax" element={<RentalTaxScreen />} />
    <Route path="/personal-income" element={<PersonalIncomeScreen />} />
    <Route path="/family-wealth" element={<FamilyWealthScreen />} />
    <Route path="/freeze-simulation" element={<FreezeSimulationScreen />} />
    <Route path="/corporate/dividends" element={<CorporateDividendsScreen />} />
    <Route path="/corporate/roc" element={<CorporateROCScreen />} />
    <Route path="/tax/exports" element={<TaxExportsScreen />} />
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
