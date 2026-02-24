import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/convexApi";

export function useBootstrapAndOrg() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const bootstrapProfile = useMutation(api.users.bootstrapProfile);
  const bootstrapOrg = useMutation(api.organizations.bootstrapDefaultOrganization);
  const myOrgs = useQuery(api.organizations.listMyOrganizations, {});
  const org = useQuery(
    api.organizations.get,
    orgId ? { organizationId: orgId as any } : "skip",
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await bootstrapProfile({});
        const orgIdResult = await bootstrapOrg({});
        if (!cancelled && !orgId && orgIdResult) {
          void navigate(`/org/${String(orgIdResult)}/dashboard`, { replace: true });
        }
      } catch {
        // login page handles auth failures; org routes remain guarded
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bootstrapOrg, bootstrapProfile, navigate, orgId]);

  return { orgId, myOrgs, org };
}
