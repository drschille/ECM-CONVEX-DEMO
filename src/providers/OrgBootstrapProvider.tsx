/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "@/lib/convexApi";

type OrgBootstrapContextValue = {
  orgId?: string;
  bootstrapReady: boolean;
  myProfile: any;
  myOrgs: any[] | undefined;
  org: any;
};

const OrgBootstrapContext = createContext<OrgBootstrapContextValue | null>(null);

let sharedBootstrapPromise: Promise<string | null> | null = null;
let sharedBootstrapDone = false;

export function OrgBootstrapProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [bootstrapReady, setBootstrapReady] = useState(false);
  const bootstrapProfile = useMutation(api.users.bootstrapProfile);
  const bootstrapOrg = useMutation(api.organizations.bootstrapDefaultOrganization);
  const orgMatch = location.pathname.match(/^\/org\/([^/]+)/);
  const orgId = orgMatch?.[1];

  const myProfile = useQuery(api.users.myProfile, isAuthenticated ? {} : "skip");
  const profileReady = Boolean(myProfile?._id);
  const myOrgs = useQuery(
    api.organizations.listMyOrganizations,
    isAuthenticated && bootstrapReady && profileReady ? {} : "skip",
  );
  const routeOrgIsKnown =
    !orgId || (myOrgs ?? []).some((entry: any) => String(entry.organizationId) === orgId);
  const org = useQuery(
    api.organizations.get,
    isAuthenticated && bootstrapReady && profileReady && orgId && routeOrgIsKnown
      ? { organizationId: orgId as any }
      : "skip",
  );

  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      sharedBootstrapPromise = null;
      sharedBootstrapDone = false;
      void Promise.resolve().then(() => {
        setBootstrapReady(false);
      });
      return;
    }

    let cancelled = false;

    if (sharedBootstrapDone && profileReady) {
      void Promise.resolve().then(() => {
        if (!cancelled) setBootstrapReady(true);
      });
      return () => {
        cancelled = true;
      };
    }

    if (sharedBootstrapDone && !profileReady) {
      sharedBootstrapDone = false;
      sharedBootstrapPromise = null;
    }

    if (!sharedBootstrapPromise) {
      sharedBootstrapPromise = (async () => {
        await bootstrapProfile({});
        const orgIdResult = await bootstrapOrg({});
        sharedBootstrapDone = true;
        return orgIdResult ? String(orgIdResult) : null;
      })();
    }

    void (async () => {
      try {
        const orgIdResult = await sharedBootstrapPromise;
        if (!cancelled) setBootstrapReady(true);
        if (!cancelled && !orgId && orgIdResult) {
          void navigate(`/org/${orgIdResult}/dashboard`, { replace: true });
        }
      } catch {
        if (!cancelled) setBootstrapReady(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    bootstrapOrg,
    bootstrapProfile,
    isAuthenticated,
    isLoading,
    navigate,
    orgId,
    profileReady,
  ]);

  useEffect(() => {
    if (!bootstrapReady || !orgId || !myOrgs || myOrgs.length === 0) return;
    const exists = myOrgs.some((entry: any) => String(entry.organizationId) === orgId);
    if (!exists) {
      void navigate(`/org/${String(myOrgs[0].organizationId)}/dashboard`, { replace: true });
    }
  }, [bootstrapReady, myOrgs, navigate, orgId]);

  return (
    <OrgBootstrapContext.Provider
      value={{
        orgId,
        bootstrapReady,
        myProfile,
        myOrgs,
        org,
      }}
    >
      {children}
    </OrgBootstrapContext.Provider>
  );
}

export function useOrgBootstrapContext() {
  const value = useContext(OrgBootstrapContext);
  if (!value) {
    throw new Error("useOrgBootstrapContext must be used within OrgBootstrapProvider");
  }
  return value;
}
