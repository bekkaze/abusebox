import React from 'react';
import { Route, Navigate } from 'react-router-dom';

export default function PrivateRoute({ children, ...rest }) {
  const isLoggedIn = document.cookie.includes('access_token');

  return (
    <Route
      {...rest}
      element={
        isLoggedIn ? children : <Navigate to="/login" />
      }
    />
  );
}