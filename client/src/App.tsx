import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppLayout from './components/Layout/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import FeeStructure from './pages/FeeStructure';
import Transactions from './pages/Transactions';
import Adjustments from './pages/Adjustments';
import ImportExcel from './pages/ImportExcel';
import ImportHistory from './pages/ImportHistory';
import StudentLedger from './pages/StudentLedger';
import BulkGeneration from './pages/BulkGeneration';
import GeneratedLedgers from './pages/GeneratedLedgers';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="students" element={<Students />} />
        <Route path="fee-structure" element={<FeeStructure />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="adjustments" element={<Adjustments />} />
        <Route path="student-ledger" element={<StudentLedger />} />
        <Route path="bulk-generation" element={<BulkGeneration />} />
        <Route path="generated-ledgers" element={<GeneratedLedgers />} />
        <Route path="import-excel" element={<ImportExcel />} />
        <Route path="import-history" element={<ImportHistory />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
