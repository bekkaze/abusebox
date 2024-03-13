import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { useAuth } from "../services/auth/authProvider";
import { ProtectedRoute } from "./ProtectedRoute";

import Login from '../pages/Login';
import LandingPage from "../pages/Landing";
import QuickCheck from "../pages/blacklist/QuickCheck";
import DashboardLayout from "../layouts/dashboard/layout";
import BlacklistCheck from "../pages/dashboard/BlacklistCheck";
import BlacklistMonitor from "../pages/dashboard/BlacklistMonitor";
import ViewReport from "../pages/dashboard/ViewReport";
import Home from "../pages/dashboard/Home";

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
      element: (
        <DashboardLayout>
          <ProtectedRoute />
        </DashboardLayout>
      ),
      children: [
        {
          path: '/dashboard/',
          element: <Home />
        },
        {
          path: '/dashboard/blacklist-check',
          element: <BlacklistCheck />
        },
        {
          path: '/dashboard/blacklist-monitor',
          element: <BlacklistMonitor />
        },
        {
          path: '/dashboard/blacklist-monitor/report',
          element: <ViewReport />
        }
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