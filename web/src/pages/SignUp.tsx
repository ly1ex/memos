import { Link, useSearchParams } from "react-router-dom";
import { ClerkSignUpPanel } from "@/clerk-auth";
import AuthFooter from "@/components/AuthFooter";
import { useInstance } from "@/contexts/InstanceContext";
import { ROUTES } from "@/router/routes";
import { AUTH_REDIRECT_PARAM, getSafeRedirectPath } from "@/utils/auth-redirect";
import { useTranslate } from "@/utils/i18n";

const SignUp = () => {
  const t = useTranslate();
  const { generalSetting: instanceGeneralSetting, profile } = useInstance();
  const [searchParams] = useSearchParams();
  const redirectTarget = getSafeRedirectPath(searchParams.get(AUTH_REDIRECT_PARAM));
  const signInPath = searchParams.toString() ? `${ROUTES.AUTH}?${searchParams.toString()}` : ROUTES.AUTH;

  return (
    <div className="py-4 sm:py-8 w-80 max-w-full min-h-svh mx-auto flex flex-col justify-start items-center">
      <div className="w-full py-4 grow flex flex-col justify-center items-center">
        <div className="w-full flex flex-row justify-center items-center mb-6">
          <img className="h-14 w-auto rounded-full shadow" src={instanceGeneralSetting.customProfile?.logoUrl || "/logo.webp"} alt="" />
          <p className="ml-2 text-5xl text-foreground opacity-80">{instanceGeneralSetting.customProfile?.title || "Memos"}</p>
        </div>
        <ClerkSignUpPanel redirectUrl={redirectTarget || ROUTES.HOME} />
        {profile.needsSetup ? (
          <p className="w-full mt-4 text-sm font-medium text-muted-foreground">{t("auth.host-tip")}</p>
        ) : (
          <p className="w-full mt-4 text-sm">
            <span className="text-muted-foreground">{t("auth.sign-in-tip")}</span>
            <Link to={signInPath} className="cursor-pointer ml-2 text-primary hover:underline" viewTransition>
              {t("common.sign-in")}
            </Link>
          </p>
        )}
      </div>
      <AuthFooter />
    </div>
  );
};

export default SignUp;
