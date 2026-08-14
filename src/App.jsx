import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './services/auth.jsx';
import { ThemeProvider } from './services/theme.jsx';
import { LanguageProvider, useLang } from './i18n/index.jsx';
import { ToastProvider } from './components/common/toast.jsx';
import AuthPage from './pages/AuthPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import VerifyEmailPage from './pages/VerifyEmailPage.jsx';
import ProfileSetupPage from './pages/ProfileSetupPage.jsx';
import OnboardingPage from './pages/OnboardingPage.jsx';
import StudentDashboard from './pages/StudentDashboard.jsx';
import CompanyDashboard from './pages/CompanyDashboard.jsx';
import CareerDashboard from './pages/CareerDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AccountPage from './pages/AccountPage.jsx';
import LandingPage from './pages/LandingPage.jsx';

const DASHBOARDS = {
  student: StudentDashboard,
  company: CompanyDashboard,
  career: CareerDashboard,
  admin: AdminDashboard,
};

/**
 * One route for all four roles — `users.role` decides what renders. A
 * dual-role account (user.is_admin, role isn't 'admin' — see
 * db/schema.sql) can override this per-session via `viewMode`, set by the
 * portal-choice screen in AuthPage after login or the switcher in Shell's
 * header.
 */
function Dashboard() {
  const { user, loading, viewMode } = useAuth();
  const { t } = useLang();
  if (loading) return <p className="p-8 text-gray-500">{t('common.loading')}</p>;
  if (!user) return <Navigate to="/" replace />;

  const effectiveRole = viewMode === 'admin' && user.is_admin ? 'admin' : user.role;
  const Component = DASHBOARDS[effectiveRole];
  return Component ? <Component /> : <p className="p-8">Unknown role: {user.role}</p>;
}

function Home() {
  const { user, loading } = useAuth();
  const { t } = useLang();
  if (loading) return <p className="p-8 text-gray-500">{t('common.loading')}</p>;
  // Already signed in? Skip straight to the dashboard, so '/' is the Advisor
  // page rather than bouncing to '/dashboard'. Signed out? Show the actual
  // pitch (LandingPage) instead of bouncing straight to a login form — a
  // first-time visitor should see what Darbi is before being asked for a
  // password.
  if (user) return <Dashboard />;
  return <LandingPage />;
}

function Account() {
  const { user, loading } = useAuth();
  const { t } = useLang();
  if (loading) return <p className="p-8 text-gray-500">{t('common.loading')}</p>;
  if (!user) return <Navigate to="/" replace />;
  return <AccountPage />;
}

/**
 * The post-signup sequence — verify email, then level/interests/location,
 * then the questionnaire — is student-only, and only while signed in. All
 * three guard the same way, so one helper builds each route's element.
 */
function studentOnlyRoute(Page) {
  return function Guarded() {
    const { user, loading } = useAuth();
    const { t } = useLang();
    if (loading) return <p className="p-8 text-gray-500">{t('common.loading')}</p>;
    if (!user) return <Navigate to="/" replace />;
    if (user.role !== 'student') return <Navigate to="/" replace />;
    return <Page />;
  };
}

const VerifyEmail = studentOnlyRoute(VerifyEmailPage);
const ProfileSetup = studentOnlyRoute(ProfileSetupPage);
const Onboarding = studentOnlyRoute(OnboardingPage);

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/portal/:role" element={<AuthPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/profile-setup" element={<ProfileSetup />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/account" element={<Account />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
