import { useEffect, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/convexApi";

let sharedBootstrapPromise: Promise<string | null> | null = null;
let sharedBootstrapDone = false;

export function useBootstrapAndOrg() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [bootstrapReady, setBootstrapReady] = useState(false);
  const bootstrapProfile = useMutation(api.users.bootstrapProfile);
  const bootstrapOrg = useMutation(api.organizations.bootstrapDefaultOrganization);
  const myOrgs = useQuery(
    api.organizations.listMyOrganizations,
    isAuthenticated && bootstrapReady ? {} : "skip",
  );
  const routeOrgIsKnown =
    !orgId || (myOrgs ?? []).some((entry: any) => String(entry.organizationId) === orgId);
  const org = useQuery(
    api.organizations.get,
    isAuthenticated && bootstrapReady && orgId && routeOrgIsKnown
      ? { organizationId: orgId as any }
      : "skip",
  );

  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      sharedBootstrapPromise = null;
      sharedBootstrapDone = false;
      return;
    }
    let cancelled = false;
    if (sharedBootstrapDone) {
      void Promise.resolve().then(() => {
        if (!cancelled) {
          setBootstrapReady(true);
        }
      });
      return () => {
        cancelled = true;
      };
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
        if (!cancelled) {
          setBootstrapReady(true);
        }
        if (!cancelled && !orgId && orgIdResult) {
          void navigate(`/org/${orgIdResult}/dashboard`, { replace: true });
        }
      } catch {
        if (!cancelled) {
          setBootstrapReady(false);
        }
        // login page handles auth failures; org routes remain guarded
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bootstrapOrg, bootstrapProfile, isAuthenticated, isLoading, navigate, orgId]);

  useEffect(() => {
    if (!bootstrapReady || !orgId || !myOrgs) return;
    if (myOrgs.length === 0) return;
    const exists = myOrgs.some((entry: any) => String(entry.organizationId) === orgId);
    if (!exists) {
      void navigate(`/org/${String(myOrgs[0].organizationId)}/dashboard`, { replace: true });
    }
  }, [bootstrapReady, myOrgs, navigate, orgId]);

  return { orgId, myOrgs, org, bootstrapReady };
}
