import { useParams } from "react-router-dom";
import { useOrgBootstrapContext } from "@/providers/OrgBootstrapProvider";

export function useBootstrapAndOrg() {
  const { orgId } = useParams<{ orgId: string }>();
  const ctx = useOrgBootstrapContext();
  return {
    ...ctx,
    orgId: orgId ?? ctx.orgId,
  };
}
