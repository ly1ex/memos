import { ClerkProvider, SignIn, SignUp, useAuth as useClerkAuth, useUser as useClerkUser } from "@clerk/react";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

type TokenProvider = () => Promise<string | null>;
type SignOutProvider = () => Promise<void>;

let tokenProvider: TokenProvider | null = null;
let signOutProvider: SignOutProvider | null = null;

interface FrontendAuthState {
  ready: boolean;
  sessionKey: string;
}

export interface ClerkProfileData {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  username: string;
}

const disabledAuthState: FrontendAuthState = {
  ready: true,
  sessionKey: "disabled",
};

const loadingAuthState: FrontendAuthState = {
  ready: false,
  sessionKey: "loading",
};

const FrontendAuthContext = createContext<FrontendAuthState>(disabledAuthState);
const ClerkProfileContext = createContext<ClerkProfileData | null>(null);

export const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
export const isClerkEnabled = Boolean(clerkPublishableKey);

export function setClerkTokenProvider(provider: TokenProvider | null): void {
  tokenProvider = provider;
}

export function setClerkSignOutProvider(provider: SignOutProvider | null): void {
  signOutProvider = provider;
}

export async function getClerkRequestToken(): Promise<string | null> {
  return tokenProvider ? tokenProvider() : null;
}

export async function signOutClerkSession(): Promise<void> {
  if (signOutProvider) {
    await signOutProvider();
  }
}

export function useFrontendAuthReady(): boolean {
  return useContext(FrontendAuthContext).ready;
}

export function useFrontendAuthState(): FrontendAuthState {
  return useContext(FrontendAuthContext);
}

export function useClerkProfile(): ClerkProfileData | null {
  return useContext(ClerkProfileContext);
}

function ClerkBridge({ children }: { children: ReactNode }) {
  const { getToken, isLoaded, isSignedIn, sessionId, signOut } = useClerkAuth();
  const { user } = useClerkUser();
  const [authState, setAuthState] = useState<FrontendAuthState>(loadingAuthState);
  const profile = useMemo<ClerkProfileData | null>(() => {
    if (!isLoaded || !isSignedIn || !user) {
      return null;
    }

    const email = user.primaryEmailAddress?.emailAddress || user.emailAddresses[0]?.emailAddress || "";
    const displayName =
      user.fullName || user.username || [user.firstName, user.lastName].filter(Boolean).join(" ") || (email ? email.split("@")[0] : "");

    return {
      id: user.id,
      email,
      displayName,
      avatarUrl: user.imageUrl || "",
      username: user.username || "",
    };
  }, [isLoaded, isSignedIn, user]);

  useEffect(() => {
    if (!isLoaded) {
      setClerkTokenProvider(null);
      setClerkSignOutProvider(null);
      setAuthState(loadingAuthState);
      return;
    }

    setClerkTokenProvider(() => getToken());
    setClerkSignOutProvider(() => signOut());
    setAuthState({
      ready: true,
      sessionKey: `${isSignedIn ? "signed-in" : "signed-out"}:${sessionId ?? ""}`,
    });

    return () => {
      setClerkTokenProvider(null);
      setClerkSignOutProvider(null);
      setAuthState(loadingAuthState);
    };
  }, [getToken, isLoaded, isSignedIn, sessionId, signOut]);

  return (
    <FrontendAuthContext.Provider value={authState}>
      <ClerkProfileContext.Provider value={profile}>{children}</ClerkProfileContext.Provider>
    </FrontendAuthContext.Provider>
  );
}

export function ClerkAuthProvider({ children }: { children: ReactNode }) {
  if (!clerkPublishableKey) {
    return (
      <FrontendAuthContext.Provider value={disabledAuthState}>
        <ClerkProfileContext.Provider value={null}>{children}</ClerkProfileContext.Provider>
      </FrontendAuthContext.Provider>
    );
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} afterSignOutUrl="/auth/signin">
      <ClerkBridge>{children}</ClerkBridge>
    </ClerkProvider>
  );
}

export function ClerkSignInPanel({ redirectUrl }: { redirectUrl?: string | null }) {
  if (!isClerkEnabled) {
    return <MissingClerkConfig />;
  }

  return (
    <SignIn
      routing="path"
      path="/auth"
      signUpUrl="/auth/signup"
      forceRedirectUrl={redirectUrl || "/"}
      fallbackRedirectUrl={redirectUrl || "/"}
      appearance={clerkAppearance}
    />
  );
}

export function ClerkSignUpPanel({ redirectUrl }: { redirectUrl?: string | null }) {
  if (!isClerkEnabled) {
    return <MissingClerkConfig />;
  }

  return (
    <SignUp
      routing="path"
      path="/auth/signup"
      signInUrl="/auth"
      forceRedirectUrl={redirectUrl || "/"}
      fallbackRedirectUrl={redirectUrl || "/"}
      appearance={clerkAppearance}
    />
  );
}

function MissingClerkConfig() {
  return (
    <div className="w-full rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
      Clerk authentication is not configured. Set <span className="font-mono">VITE_CLERK_PUBLISHABLE_KEY</span> for the Cloudflare Worker
      frontend.
    </div>
  );
}

export const clerkAppearance = {
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none border border-border bg-background",
    card: "shadow-none",
    headerTitle: "text-foreground",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButton: "border-border text-foreground",
    formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90",
    footerActionLink: "text-primary hover:text-primary/90",
  },
};
