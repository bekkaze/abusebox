import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { useAuth } from "../services/auth/authProvider";
import { ProtectedRoute } from "./ProtectedRoute";

import Login from '../pages/Login';

const Routes = () => {
  const { token } = useAuth();
  
  const routesForPublic = [
    {
      path: '/home',
      element: <div>Landing Page</div>,
    },
  ];

  const routesForAuthenticatedOnly = [
    {
      path: '/',
      element: <ProtectedRoute />,
      children: [
        {
          path: '/dashboard',
          element: <div>User Dashboard</div>
        },
        {
          path: '/blacklist-check',
          element: <div>Blacklist Check</div>
        },
      ],
    },
  ];

  const routesForNotAuthenticatedOnly = [
    {
      path: '/quick-check',
      element: <div>Quick check</div>,
    },
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