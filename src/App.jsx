import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './services/auth.jsx';
import { ThemeProvider } from './services/theme.jsx';
import { LanguageProvider, useLang } from './i18n/index.jsx';
import { ToastProvider } from './components/common/toast.jsx';
import AuthPage from './pages/AuthPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import VerifyEmailPage from './pages/VerifyEmailPage.jsx';
import ProfileSetupPage from './pages/ProfileSetupPage.jsx';
import CompanyProfileSetupPage from './pages/CompanyProfileSetupPage.jsx';
import OnboardingPage from './pages/OnboardingPage.jsx';
import StudentDashboard from './pages/StudentDashboard.jsx';
import CompanyDashboard from './pages/CompanyDashboard.jsx';
import CareerDashboard from './pages/CareerDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AccountPage from './pages/AccountPage.jsx';
import LandingPage from './pages/LandingPage.jsx';
import AboutDataPage from './pages/AboutDataPage.jsx';

const DASHBOARDS = {
  student: StudentDashboard,
  company: CompanyDashboard,
  career: CareerDashboard,
  admin: AdminDashboard,
};

// Industry/description/website/location/logo — CompanyProfileSetupPage's
// required fields. Checked here too (not just on that page) so a company
// that verified and then left mid-setup gets sent back to finish it on
// every later visit, not just right after signup.
const COMPANY_PROFILE_FIELDS = ['industry', 'description', 'website', 'location', 'logo'];
function isCompanyProfileComplete(profile) {
  return COMPANY_PROFILE_FIELDS.every((field) => Boolean(profile?.[field]));
}

/**
 * One route for all four roles — `users.role` decides what renders. A
 * dual-role account (user.is_admin, role isn't 'admin' — see
 * db/schema.sql) can override this per-session via `viewMode`, set by the
 * portal-choice screen in AuthPage after login or the switcher in Shell's
 * header.
 */
function Dashboard() {
  const { user, profile, loading, viewMode } = useAuth();
  const { t } = useLang();
  if (loading) return <p className="p-8 text-gray-500">{t('common.loading')}</p>;
  if (!user) return <Navigate to="/" replace />;

  const effectiveRole = viewMode === 'admin' && user.is_admin ? 'admin' : user.role;
  if (effectiveRole === 'company' && !isCompanyProfileComplete(profile)) {
    return <Navigate to="/company-profile-setup" replace />;
  }
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
 * then the questionnaire — only applies while signed in, and each step is
 * gated to whichever roles actually have it. Verify-email is shared by
 * student and company (both collect a code at signup); profile-setup and
 * onboarding are still student-only.
 */
function roleRoute(Page, allowedRoles) {
  return function Guarded() {
    const { user, loading } = useAuth();
    const { t } = useLang();
    if (loading) return <p className="p-8 text-gray-500">{t('common.loading')}</p>;
    if (!user) return <Navigate to="/" replace />;
    if (!allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
    return <Page />;
  };
}

const VerifyEmail = roleRoute(VerifyEmailPage, ['student', 'company']);
const ProfileSetup = roleRoute(ProfileSetupPage, ['student']);
const CompanyProfileSetup = roleRoute(CompanyProfileSetupPage, ['company']);
const Onboarding = roleRoute(OnboardingPage, ['student']);

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
                <Route path="/company-profile-setup" element={<CompanyProfileSetup />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/about-data" element={<AboutDataPage />} />
                <Route path="/account" element={<Account />} />
                <Route path="/dashboard" element={<Dashboard />} />
                {/* Pre-rename URL for what's now the Graduate Portal (see
                    today's "Career Boost" -> "Graduate" rename) — redirect
                    rather than 404, since it used to be a real destination. */}
                <Route path="/career-boost" element={<Navigate to="/portal/career" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
