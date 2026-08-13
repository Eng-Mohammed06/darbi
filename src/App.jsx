import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './services/auth.jsx';
import AuthPage from './pages/AuthPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import OnboardingPage from './pages/OnboardingPage.jsx';
import StudentDashboard from './pages/StudentDashboard.jsx';
import CompanyDashboard from './pages/CompanyDashboard.jsx';
import CareerDashboard from './pages/CareerDashboard.jsx';
import AccountPage from './pages/AccountPage.jsx';

const DASHBOARDS = {
  student: StudentDashboard,
  company: CompanyDashboard,
  career: CareerDashboard,
};

/** One route for all three portals — `users.role` decides what renders. */
function Dashboard() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8 text-gray-500">Loading…</p>;
  if (!user) return <Navigate to="/" replace />;

  const Component = DASHBOARDS[user.role];
  return Component ? <Component /> : <p className="p-8">Unknown role: {user.role}</p>;
}

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8 text-gray-500">Loading…</p>;
  // Already signed in? Skip straight to the dashboard, so '/' is the Advisor
  // page rather than bouncing to '/dashboard'. Signed out? The login page
  // has its own Student/Graduate/Company switcher, so there's no separate
  // portal-picker page to bounce to first.
  if (user) return <Dashboard />;
  return <Navigate to="/portal/student" replace />;
}

function Account() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8 text-gray-500">Loading…</p>;
  if (!user) return <Navigate to="/" replace />;
  return <AccountPage />;
}

/** The post-signup questionnaire — student-only, and only while signed in. */
function Onboarding() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8 text-gray-500">Loading…</p>;
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== 'student') return <Navigate to="/" replace />;
  return <OnboardingPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/portal/:role" element={<AuthPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/account" element={<Account />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
