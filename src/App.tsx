import { Authenticated, Unauthenticated, useConvexAuth } from "convex/react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { OrgScaffoldPage } from "./pages/OrgScaffoldPage";

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
      <Route path="/" element={<Navigate replace to="/login" />} />
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
        <Route
          path="dashboard"
          element={
            <OrgScaffoldPage
              title="Dashboard"
              description="Open change requests, overdue work, and assignment views will appear here."
            />
          }
        />
        <Route
          path="items"
          element={
            <OrgScaffoldPage
              title="Items Registry"
              description="Part and document records, search/filter, and CSV import live here."
            />
          }
        />
        <Route
          path="changes"
          element={
            <OrgScaffoldPage
              title="Change Requests"
              description="CR list, workflow status tracking, and triage/review queues."
            />
          }
        />
        <Route
          path="changes/new"
          element={
            <OrgScaffoldPage
              title="New Change Request"
              description="Structured CR creation form with affected items, attachments, and ownership."
            />
          }
        />
        <Route
          path="changes/:crId"
          element={
            <OrgScaffoldPage
              title="Change Request Detail"
              description="Overview, affected items, approvals, comments, notifications, and audit history."
            />
          }
        />
        <Route
          path="reports"
          element={
            <OrgScaffoldPage
              title="Reports"
              description="Filterable reports and CSV exports for status, owner, priority, and date ranges."
            />
          }
        />
        <Route
          path="audit"
          element={
            <OrgScaffoldPage
              title="Audit Log"
              description="Immutable compliance events for CRUD actions, approvals, and workflow transitions."
            />
          }
        />
        <Route
          path="settings"
          element={
            <OrgScaffoldPage
              title="Organization Settings"
              description="Members, roles, approval policies, and organization configuration (admin-only)."
            />
          }
        />
      </Route>

      <Route path="*" element={<Navigate replace to="/login" />} />
    </Routes>
  );
}
