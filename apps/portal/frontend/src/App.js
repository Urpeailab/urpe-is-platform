import React from 'react';
import './i18n';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminAuthProvider, useAdminAuth } from './contexts/AdminAuthContext';
import { AdminLogin } from './admin/pages/AdminLogin';
import { MagicLinkVerify } from './admin/pages/MagicLinkVerify';
import { TestPage } from './admin/pages/TestPage';
import { AdminLayout } from './admin/layouts/AdminLayout';
import { AdminDashboard } from './admin/pages/AdminDashboard';
import { AdminDashboardSimple } from './admin/pages/AdminDashboardSimple';
import { StaffList } from './admin/pages/StaffList';
import { UsersList } from './admin/pages/UsersList';
import { UserDetail } from './admin/pages/UserDetail';
import { UserEdit } from './admin/pages/UserEdit';
import { AdvisorsList } from './admin/pages/AdvisorsList';
import { StaffManagement } from './admin/pages/StaffManagement';
import { StaffCreate } from './admin/pages/StaffCreate';
import { StaffEdit } from './admin/pages/StaffEdit';
import StaffDetail from './admin/pages/StaffDetail';
import { VisaCasesList } from './admin/pages/VisaCasesList';
import { VisaCaseCreate } from './admin/pages/VisaCaseCreate';
import { VisaCaseDetailRedesign } from './admin/pages/VisaCaseDetailRedesign';
import { WebinarsList } from './admin/pages/WebinarsList';
import { MasterCaseEditor } from './admin/pages/MasterCaseEditor';
import { SuccessStoriesAdmin } from './admin/pages/SuccessStoriesAdmin';
import PaymentAuthorizationsList from './admin/pages/PaymentAuthorizationsList';
import ProposalPage from './admin/pages/ProposalPage';
import ClassicCasesList from './admin/pages/ClassicCasesList';
import ClassicCaseDetail from './admin/pages/ClassicCaseDetail';
import ClassicReports from './admin/pages/ClassicReports';
import ClassicBulkEmail from './admin/pages/ClassicBulkEmail';
import { LegalLibrary } from './admin/pages/LegalLibrary';
import { LearningManagement } from './admin/pages/LearningManagement';
import { LearningModuleEditor } from './admin/pages/LearningModuleEditor';
import { LearningSessionsAudit } from './admin/pages/LearningSessionsAudit';
import { LearningHub } from './admin/pages/LearningHub';
import { LearningSession } from './admin/pages/LearningSession';
import { ComparatorCases } from './admin/pages/ComparatorCases';
import { TimelineTemplates } from './admin/pages/TimelineTemplates';
import { TimelineManagement } from './admin/pages/TimelineManagement';
import { AuditLogs } from './admin/pages/AuditLogs';
import { EligibilityTemplates } from './admin/pages/EligibilityTemplates';
import { TestEligibility } from './admin/pages/TestEligibility';
import { TimelineOverview } from './admin/pages/TimelineOverview';
import { FilingTimelineData } from './admin/pages/FilingTimelineData';
import Landing1 from './pages/Landing1';
import Landing2 from './pages/Landing2';
import Landing3 from './pages/Landing3';
import { AdminProfilePage } from './admin/pages/AdminProfilePage';
import { AdminChangePasswordPage } from './admin/pages/AdminChangePasswordPage';
import { PaymentsList } from './admin/pages/PaymentsList';
import { FileManagement } from './admin/pages/FileManagement';
import { AppointmentsManagement } from './admin/pages/AppointmentsManagement';
import { ManualPaymentsManagement } from './admin/pages/ManualPaymentsManagement';
import { LeadsManagement } from './admin/pages/LeadsManagement';
import { StageManagement } from './admin/pages/StageManagement';
import { DeliverableDocumentManagement } from './admin/pages/DeliverableDocumentManagement';
import { SpyDashboard } from './admin/pages/SpyDashboard';
import USCISFormsDashboard from './admin/pages/USCISFormsDashboard';
import USCISFormsNew from './admin/pages/USCISFormsNew';
import USCISFormsFill from './admin/pages/USCISFormsFill';
import PublicFormRouter from './public/PublicFormRouter';
import { PaymentInstructionsPage } from './pages/PaymentInstructionsPage';
import { Navbar } from './components/Navbar';
import { MonicaChat } from './components/MonicaChat';
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Eligibility } from './pages/Eligibility';
import { Auth } from './pages/Auth';
import PhoneAuth from './pages/PhoneAuth';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import PaymentAuthForm from './public/PaymentAuthForm';
import { Panel } from './pages/Panel';
import { Messages } from './pages/Messages';
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';
import { DashboardLayout } from './layouts/DashboardLayout';
import { DashboardHome } from './pages/dashboard/DashboardHome';
import { Appointments } from './pages/dashboard/Appointments';
import { EligibilityReportPage } from './pages/dashboard/EligibilityReportPage';
import { DashboardMessages } from './pages/dashboard/DashboardMessages';
import { WebinarsPage } from './pages/dashboard/WebinarsPage';
import { LegalLibraryPage } from './pages/dashboard/LegalLibraryPage';
import { SuccessCalculatorPage } from './pages/dashboard/SuccessCalculatorPage';
import { SuccessStoriesPage } from './pages/dashboard/SuccessStoriesPage';
import ComparatorPage from './pages/dashboard/ComparatorPage';
import TimelinePredictorPage from './pages/dashboard/TimelinePredictorPage';
import DocumentationPackagePage from './pages/dashboard/DocumentationPackagePage';
import { ProfilePage } from './pages/dashboard/ProfilePage';
import { ChangePasswordPage } from './pages/dashboard/ChangePasswordPage';
import { MyCasePage } from './pages/dashboard/MyCasePage';
import { StageDetailPage } from './pages/dashboard/StageDetailPage';
import { DocumentsPage } from './pages/dashboard/DocumentsPage';
import { PaymentsPage } from './pages/dashboard/PaymentsPage';
import { PaymentSuccessPage } from './pages/dashboard/PaymentSuccessPage';
import { USCISTrackerPage } from './pages/dashboard/USCISTrackerPage';
import { USCISCaseDetailPage } from './pages/dashboard/USCISCaseDetailPage';
import { DemoCheckoutPage } from './pages/demo/DemoCheckoutPage';
import { WelcomeMagicLink } from './pages/WelcomeMagicLink';
import { Toaster } from './components/ui/sonner';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white text-xl">Loading...</p>
      </div>
    );
  }

  return user ? children : <Navigate to="/auth" replace />;
};

// Admin Protected Route Component
const AdminProtectedRoute = ({ children }) => {
  const { admin, loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white text-xl">Loading...</p>
      </div>
    );
  }

  return admin ? children : <Navigate to="/admin/login" replace />;
};

function AppContent() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isDashboardRoute = location.pathname.startsWith('/dashboard');
  const isPublicFormRoute = location.pathname.startsWith('/uscis-form') || location.pathname.startsWith('/payment-authorization');

  return (
    <div className="App">
      {!isAdminRoute && !isDashboardRoute && !isPublicFormRoute && <Navbar />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/landing/1" element={<Landing1 />} />
        <Route path="/landing/2" element={<Landing2 />} />
        <Route path="/landing/3" element={<Landing3 />} />
        <Route path="/about" element={<About />} />
        <Route path="/eligibility" element={<Eligibility />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/phone-login" element={<PhoneAuth />} />
        <Route path="/welcome/:token" element={<WelcomeMagicLink />} />
        <Route path="/uscis-form/:token" element={<PublicFormRouter />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/payment-authorization" element={<PaymentAuthForm />} />
        <Route
          path="/panel"
          element={
            <ProtectedRoute>
              <Panel />
            </ProtectedRoute>
          }
        />
        <Route path="/messages" element={<Messages />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        
        {/* Dashboard Routes */}
        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Routes>
                  <Route index element={<DashboardHome />} />
                  {/* Old Eligibility Report - Hidden, now using success-calculator as Reporte de Elegibilidad */}
                  {/* <Route path="eligibility-report" element={<EligibilityReportPage />} /> */}
                  <Route path="my-case" element={<MyCasePage />} />
                  <Route path="my-case/stage/:stageNumber" element={<StageDetailPage />} />
                  <Route path="documents" element={<DocumentsPage />} />
                  <Route path="payments" element={<PaymentsPage />} />
                  <Route path="appointments" element={<Appointments />} />
                  <Route path="messages" element={<DashboardMessages />} />
                  <Route path="webinars" element={<WebinarsPage />} />
                  <Route path="legal-library" element={<LegalLibraryPage />} />
                  <Route path="success-calculator" element={<SuccessCalculatorPage />} />
                  <Route path="success-stories" element={<SuccessStoriesPage />} />
                  <Route path="comparator" element={<ComparatorPage />} />
                  <Route path="timeline-predictor" element={<TimelinePredictorPage />} />
                  <Route path="documentation-package" element={<DocumentationPackagePage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="change-password" element={<ChangePasswordPage />} />
                  <Route path="payment-success" element={<PaymentSuccessPage />} />
                  <Route path="uscis-tracker" element={<USCISTrackerPage />} />
                  <Route path="uscis-case/:receiptNumber" element={<USCISCaseDetailPage />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        
        {/* Demo Checkout - Protected Route without Dashboard Layout */}
        <Route
          path="/demo-checkout"
          element={
            <ProtectedRoute>
              <DemoCheckoutPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payment-instructions"
          element={<PaymentInstructionsPage />}
        />
        
        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/magic-link/:token" element={<MagicLinkVerify />} />
        <Route path="/admin/test" element={<TestPage />} />
        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <AdminLayout />
            </AdminProtectedRoute>
          }
        >
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<UsersList />} />
          <Route path="users/:userId" element={<UserDetail />} />
          <Route path="users/:userId/edit" element={<UserEdit />} />
          {/* New unified pages */}
          <Route path="staff-management" element={<StaffManagement />} />
          <Route path="staff/create" element={<StaffCreate />} />
          <Route path="staff/:staffId/detail" element={<StaffDetail />} />
          <Route path="staff/:staffId" element={<StaffEdit />} />
          <Route path="timeline-management" element={<TimelineManagement />} />
          {/* Visa Cases Routes */}
          <Route path="visa-cases" element={<VisaCasesList />} />
          <Route path="visa-cases/create" element={<VisaCaseCreate />} />
          <Route path="visa-cases/:caseId" element={<VisaCaseDetailRedesign />} />
          {/* Legacy routes - redirect to new pages */}
          <Route path="staff" element={<Navigate to="/admin/staff-management" replace />} />
          <Route path="advisors" element={<Navigate to="/admin/staff-management" replace />} />
          <Route path="timeline" element={<Navigate to="/admin/timeline-management" replace />} />
          <Route path="timeline-overview" element={<Navigate to="/admin/timeline-management" replace />} />
          <Route path="filing-timeline-data" element={<Navigate to="/admin/timeline-management" replace />} />
          {/* Other routes */}
          <Route path="webinars" element={<WebinarsList />} />
          <Route path="master-case" element={<MasterCaseEditor />} />
          <Route path="success-stories" element={<SuccessStoriesAdmin />} />
                  <Route path="payment-authorizations" element={<PaymentAuthorizationsList />} />
                  <Route path="proposal" element={<ProposalPage />} />
                  <Route path="classic-cases" element={<ClassicCasesList />} />
                  <Route path="classic-cases/reports" element={<ClassicReports />} />
                  <Route path="classic-cases/bulk-email" element={<ClassicBulkEmail />} />
                  <Route path="classic-cases/:caseId" element={<ClassicCaseDetail />} />
          <Route path="legal-library" element={<LegalLibrary />} />
          {/* Aprendizaje (staff) */}
          <Route path="learning" element={<LearningHub />} />
          <Route path="learning/session" element={<LearningSession />} />
          {/* Aprendizaje (admin) */}
          <Route path="learning-admin" element={<LearningManagement />} />
          <Route path="learning-admin/new" element={<LearningModuleEditor />} />
          <Route path="learning-admin/sessions" element={<LearningSessionsAudit />} />
          <Route path="learning-admin/:moduleId" element={<LearningModuleEditor />} />
          <Route path="comparator" element={<ComparatorCases />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="eligibility-templates" element={<EligibilityTemplates />} />
          <Route path="test-eligibility" element={<TestEligibility />} />
          <Route path="appointments" element={<AppointmentsManagement />} />
          <Route path="payments" element={<PaymentsList />} />
          <Route path="manual-payments" element={<ManualPaymentsManagement />} />
          <Route path="leads" element={<LeadsManagement />} />
          <Route path="stage-management" element={<StageManagement />} />
          <Route path="deliverable-management" element={<DeliverableDocumentManagement />} />
          <Route path="spy" element={<SpyDashboard />} />
          <Route path="uscis-forms" element={<USCISFormsDashboard />} />
          <Route path="uscis-forms/new" element={<USCISFormsNew />} />
          <Route path="uscis-forms/fill/:templateId" element={<USCISFormsFill />} />
          <Route path="files" element={<FileManagement />} />
          <Route path="profile" element={<AdminProfilePage />} />
          <Route path="change-password" element={<AdminChangePasswordPage />} />
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {/* MonicaChat hidden per user request */}
      {/* <MonicaChat /> */}
      <Toaster position="top-right" />
    </div>
  );
}

function App() {
  return (
    <AdminAuthProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </AuthProvider>
    </AdminAuthProvider>
  );
}

export default App;
