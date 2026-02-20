import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { hasActiveSession } from '../../services/authSession';

type RequireAuthProps = {
  children: ReactElement;
};

const RequireAuth = ({ children }: RequireAuthProps) => {
  const location = useLocation();

  if (!hasActiveSession()) {
    // Keep the requested location for future redirect-after-login support.
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return children;
};

export default RequireAuth;
