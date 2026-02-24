import { Authenticated, Unauthenticated, useConvexAuth } from "convex/react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { OrgDashboardPage } from "./pages/OrgDashboardPage";
import { ItemsPage } from "./pages/ItemsPage";
import { ChangesListPage } from "./pages/ChangesListPage";
import { NewChangeRequestPage } from "./pages/NewChangeRequestPage";
import { ChangeRequestDetailPage } from "./pages/ChangeRequestDetailPage";
import { ReportsPage } from "./pages/ReportsPage";
import { AuditPage } from "./pages/AuditPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useBootstrapAndOrg } from "./hooks/useOrgContext";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          Loading session...
        </div>
      </div>
    );
  }

  return (
    <>
      <Authenticated>{children}</Authenticated>
      <Unauthenticated>
        <Navigate replace to="/login" />
      </Unauthenticated>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/org/:orgId"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate replace to="dashboard" />} />
        <Route path="dashboard" element={<OrgRouteRenderer render={(orgId) => <OrgDashboardPage organizationId={orgId} />} />} />
        <Route path="items" element={<OrgRouteRenderer render={(orgId) => <ItemsPage organizationId={orgId} />} />} />
        <Route path="changes" element={<OrgRouteRenderer render={(orgId) => <ChangesListPage organizationId={orgId} />} />} />
        <Route path="changes/new" element={<OrgRouteRenderer render={(orgId) => <NewChangeRequestPage organizationId={orgId} />} />} />
        <Route path="changes/:crId" element={<OrgRouteRenderer render={(orgId) => <ChangeRequestDetailPage organizationId={orgId} />} />} />
        <Route path="reports" element={<OrgRouteRenderer render={(orgId) => <ReportsPage organizationId={orgId} />} />} />
        <Route path="audit" element={<OrgRouteRenderer render={(orgId) => <AuditPage organizationId={orgId} />} />} />
        <Route path="settings" element={<OrgRouteRenderer render={(orgId) => <SettingsPage organizationId={orgId} />} />} />
      </Route>

      <Route path="*" element={<Navigate replace to="/login" />} />
    </Routes>
  );
}

function HomeRedirect() {
  const { isLoading } = useConvexAuth();
  const { myOrgs } = useBootstrapAndOrg();
  if (isLoading) {
    return <div className="grid min-h-screen place-items-center text-sm text-slate-600">Loading...</div>;
  }
  return (
    <>
      <Authenticated>
        {myOrgs && myOrgs.length > 0 ? (
          <Navigate replace to={`/org/${String(myOrgs[0].organizationId)}/dashboard`} />
        ) : (
          <div className="grid min-h-screen place-items-center text-sm text-slate-600">
            Provisioning organization...
          </div>
        )}
      </Authenticated>
      <Unauthenticated>
        <Navigate replace to="/login" />
      </Unauthenticated>
    </>
  );
}

function OrgRouteRenderer({
  render,
}: {
  render: (organizationId: string) => React.ReactNode;
}) {
  const { orgId } = useBootstrapAndOrg();
  if (!orgId) {
    return <div className="text-sm text-slate-500">Loading organization...</div>;
  }
  return <>{render(orgId)}</>;
}
