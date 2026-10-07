import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";
import { lazy, Suspense, useMemo } from "react";
import { useAuth } from "../services/auth/authProvider";
import { ProtectedRoute } from "./ProtectedRoute";

import Login from '../pages/Login';
import LandingPage from "../pages/Landing";
import QuickCheck from "../pages/blacklist/QuickCheck";
import DashboardLayout from "../layouts/dashboard/layout";
import NotFound from "../pages/NotFound";

// Lazy-loaded dashboard pages — code splitting
const Home = lazy(() => import("../pages/dashboard/Home"));
const BlacklistCheck = lazy(() => import("../pages/dashboard/BlacklistCheck"));
const Assets = lazy(() => import("../pages/dashboard/Assets"));
const AssetDetail = lazy(() => import("../pages/dashboard/AssetDetail"));
const AbuseIPDB = lazy(() => import("../pages/dashboard/AbuseIPDB"));
const Whois = lazy(() => import("../pages/dashboard/Whois"));
const ServerStatus = lazy(() => import("../pages/dashboard/ServerStatus"));
const DnsRecords = lazy(() => import("../pages/dashboard/DnsRecords"));
const SslChecker = lazy(() => import("../pages/dashboard/SslChecker"));
const EmailSecurity = lazy(() => import("../pages/dashboard/EmailSecurity"));
const SubnetCheck = lazy(() => import("../pages/dashboard/SubnetCheck"));
const BulkCheck = lazy(() => import("../pages/dashboard/BulkCheck"));
const DmarcReports = lazy(() => import("../pages/dashboard/DmarcReports"));
const Settings = lazy(() => import("../pages/dashboard/Settings"));
const Activity = lazy(() => import("../pages/dashboard/Activity"));

function LazyPage({ children }) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-600"></div>
      </div>
    }>
      {children}
    </Suspense>
  );
}

const Routes = () => {
  const { token } = useAuth();

  const routesForPublic = [
    {
      path: '/',
      element: <LandingPage />,
    },
    {
      path: 'quick-check',
      element: <QuickCheck />
    }
  ];

  const routesForAuthenticatedOnly = [
    {
      path: '/dashboard',
      element: <ProtectedRoute />,
      children: [
        {
          element: <DashboardLayout />,
          children: [
            { index: true, element: <LazyPage><Home /></LazyPage> },
            { path: 'blacklist-check', element: <LazyPage><BlacklistCheck /></LazyPage> },
            { path: 'assets', element: <LazyPage><Assets /></LazyPage> },
            { path: 'activity', element: <LazyPage><Activity /></LazyPage> },
            { path: 'assets/:id', element: <LazyPage><AssetDetail /></LazyPage> },
            // Old URL from v1.0; kept so bookmarks still work.
            { path: 'blacklist-monitor', element: <LazyPage><Assets /></LazyPage> },
            { path: 'abuseipdb', element: <LazyPage><AbuseIPDB /></LazyPage> },
            { path: 'whois', element: <LazyPage><Whois /></LazyPage> },
            { path: 'server-status', element: <LazyPage><ServerStatus /></LazyPage> },
            { path: 'dns-records', element: <LazyPage><DnsRecords /></LazyPage> },
            { path: 'ssl-checker', element: <LazyPage><SslChecker /></LazyPage> },
            { path: 'email-security', element: <LazyPage><EmailSecurity /></LazyPage> },
            { path: 'subnet-check', element: <LazyPage><SubnetCheck /></LazyPage> },
            { path: 'bulk-check', element: <LazyPage><BulkCheck /></LazyPage> },
            { path: 'dmarc-reports', element: <LazyPage><DmarcReports /></LazyPage> },
            { path: 'settings', element: <LazyPage><Settings /></LazyPage> },
          ]
        },
      ],
    },
  ];

  const routesForNotAuthenticatedOnly = [
    {
      path: '/login',
      element: <Login />
    },
  ];

  const router = useMemo(() => createBrowserRouter([
    ...routesForPublic,
    // Signed-in users opening /login go straight to the dashboard.
    ...(!token ? routesForNotAuthenticatedOnly : [{ path: '/login', element: <Navigate to="/dashboard" replace /> }]),
    ...routesForAuthenticatedOnly,
    { path: '*', element: <NotFound /> },
  // Only the signed-in state changes which routes exist.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ]), [Boolean(token)]);

  return <RouterProvider router={router} />;
}

export default Routes;
