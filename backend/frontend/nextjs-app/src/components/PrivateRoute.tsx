// src/components/PrivateRoute.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';

interface PrivateRouteProps {
  children: JSX.Element;
}

export default function PrivateRoute({ children }: PrivateRouteProps) {
  const token =
    (typeof window !== 'undefined' && localStorage.getItem('captely_jwt')) ||
    sessionStorage.getItem('captely_jwt');

  return token ? children : <Navigate to="/login" replace />;
}
