import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useApp } from './context/AppContext';
import { canViewScreen } from './services/auth';
import type { ScreenKey } from './db/types';
import { Layout } from './components/Layout';
import { EmptyState } from './components/ui/Page';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Payment from './pages/Payment';
import Receipt from './pages/Receipt';
import CashReset from './pages/CashReset';
import DeviceIntake from './pages/DeviceIntake';
import DeviceDelivery from './pages/DeviceDelivery';
import AdvanceRefund from './pages/AdvanceRefund';
import CreditProgramming from './pages/CreditProgramming';
import Pos from './pages/Pos';
import BalanceSales from './pages/BalanceSales';
import Accounts from './pages/Accounts';
import Accessories from './pages/Accessories';
import ServiceSetup from './pages/ServiceSetup';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Reports from './pages/Reports';

function Loader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-app" dir="rtl">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl brand-gradient text-white flex items-center justify-center mx-auto mb-4 animate-pulse">
          <i className="fa-solid fa-microchip text-2xl"></i>
        </div>
        <p className="text-ink-500 font-semibold">جاري تحميل النظام...</p>
      </div>
    </div>
  );
}

function Guard({ screen, children }: { screen: ScreenKey; children: JSX.Element }) {
  const { user } = useApp();
  if (!canViewScreen(user, screen)) {
    return (
      <Layout>
        <EmptyState icon="fa-lock" title="لا تملك صلاحية الوصول لهذه الشاشة"
          hint="يرجى مراجعة مدير النظام لمنحك الصلاحية المناسبة" />
      </Layout>
    );
  }
  return <Layout>{children}</Layout>;
}

export default function App() {
  const { ready, user } = useApp();
  const location = useLocation();

  if (!ready) return <Loader />;

  if (!user) {
    if (location.pathname !== '/login') return <Navigate to="/login" replace />;
    return <Login />;
  }

  if (location.pathname === '/login') return <Navigate to="/" replace />;

  return (
    <Routes>
      <Route path="/" element={<Guard screen="dashboard"><Dashboard /></Guard>} />
      <Route path="/receipt" element={<Guard screen="receipt"><Receipt /></Guard>} />
      <Route path="/payment" element={<Guard screen="payment"><Payment /></Guard>} />
      <Route path="/cash-reset" element={<Guard screen="cashReset"><CashReset /></Guard>} />
      <Route path="/intake" element={<Guard screen="deviceIntake"><DeviceIntake /></Guard>} />
      <Route path="/delivery" element={<Guard screen="deviceDelivery"><DeviceDelivery /></Guard>} />
      <Route path="/refund" element={<Guard screen="advanceRefund"><AdvanceRefund /></Guard>} />
      <Route path="/credit" element={<Guard screen="creditProgramming"><CreditProgramming /></Guard>} />
      <Route path="/pos" element={<Guard screen="pos"><Pos /></Guard>} />
      <Route path="/balance" element={<Guard screen="balanceSales"><BalanceSales /></Guard>} />
      <Route path="/accounts" element={<Guard screen="accounts"><Accounts /></Guard>} />
      <Route path="/accessories" element={<Guard screen="accessories"><Accessories /></Guard>} />
      <Route path="/reports" element={<Guard screen="reports"><Reports /></Guard>} />
      <Route path="/service-setup" element={<Guard screen="serviceSetup"><ServiceSetup /></Guard>} />
      <Route path="/users" element={<Guard screen="users"><Users /></Guard>} />
      <Route path="/settings" element={<Guard screen="settings"><Settings /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
