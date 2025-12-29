import { ReactNode, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuthStore } from "../store/auth";

type Props = {
  children: ReactNode;
};

export function RequireAuth({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const checkSession = useAuthStore((state) => state.restoreSession);
  const hasRestored = useAuthStore((state) => state.hasRestored);

  useEffect(() => {
    if (!hasRestored) {
      checkSession();
    }
  }, [checkSession, hasRestored]);

  useEffect(() => {
    if (hasRestored && !isAuthenticated) {
      navigate("/login", { replace: true, state: { from: location } });
    }
  }, [hasRestored, isAuthenticated, navigate, location]);

  if (!hasRestored) {
    return null;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
