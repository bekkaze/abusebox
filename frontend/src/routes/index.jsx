import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { useAuth } from "../services/auth/authProvider";
import { ProtectedRoute } from "./ProtectedRoute";

import Login from '../pages/Login';
import LandingPage from "../pages/Landing";
import QuickCheck from "../pages/blacklist/QuickCheck";
import DashboardLayout from "../layouts/dashboard/layout";
import BlacklistCheck from "../pages/dashboard/BlacklistCheck";
import Assets from "../pages/dashboard/Assets";
import AssetDetail from "../pages/dashboard/AssetDetail";
import ViewReport from "../pages/dashboard/ViewReport";
import Home from "../pages/dashboard/Home";
import AbuseIPDB from "../pages/dashboard/AbuseIPDB";
import Whois from "../pages/dashboard/Whois";
import ServerStatus from "../pages/dashboard/ServerStatus";
import DnsRecords from "../pages/dashboard/DnsRecords";
import SslChecker from "../pages/dashboard/SslChecker";
import EmailSecurity from "../pages/dashboard/EmailSecurity";
import SubnetCheck from "../pages/dashboard/SubnetCheck";
import BulkCheck from "../pages/dashboard/BulkCheck";

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
            {
              index: true,
              element: <Home />
            },
            {
              path: 'blacklist-check',
              element: <BlacklistCheck />
            },
            {
              path: 'assets',
              element: <Assets />
            },
            {
              path: 'assets/:id',
              element: <AssetDetail />
            },
            // Legacy routes — redirect-friendly
            {
              path: 'blacklist-monitor',
              element: <Assets />
            },
            {
              path: 'blacklist-monitor/report',
              element: <ViewReport />
            },
            {
              path: 'abuseipdb',
              element: <AbuseIPDB />
            },
            {
              path: 'whois',
              element: <Whois />
            },
            {
              path: 'server-status',
              element: <ServerStatus />
            },
            {
              path: 'dns-records',
              element: <DnsRecords />
            },
            {
              path: 'ssl-checker',
              element: <SslChecker />
            },
            {
              path: 'email-security',
              element: <EmailSecurity />
            },
            {
              path: 'subnet-check',
              element: <SubnetCheck />
            },
            {
              path: 'bulk-check',
              element: <BulkCheck />
            }
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

  const router = createBrowserRouter([
    ...routesForPublic,
    ...(!token ? routesForNotAuthenticatedOnly : []),
    ...routesForAuthenticatedOnly,
  ]);

  return <RouterProvider router={router} />;
}

export default Routes;
