import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import useNavigateTo from "@/hooks/useNavigateTo";
import { ROUTES } from "@/router/routes";
import { AUTH_REDIRECT_PARAM, getSafeRedirectPath } from "@/utils/auth-redirect";

const AuthCallback = () => {
  const navigateTo = useNavigateTo();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const redirect = getSafeRedirectPath(searchParams.get(AUTH_REDIRECT_PARAM));
    navigateTo(redirect ? `${ROUTES.AUTH}?${AUTH_REDIRECT_PARAM}=${encodeURIComponent(redirect)}` : ROUTES.AUTH, { replace: true });
  }, [navigateTo, searchParams]);

  return null;
};

export default AuthCallback;
