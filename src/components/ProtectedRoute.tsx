import { PropsWithChildren } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuthStore, type AuthState } from '../store/authStore';

export function ProtectedRoute({ children }: PropsWithChildren) {
  const token = useAuthStore((state: AuthState) => state.token);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
