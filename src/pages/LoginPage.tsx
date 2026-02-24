import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";

export function LoginPage() {
  const { signIn } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!isLoading && isAuthenticated) {
    return <Navigate replace to="/org/default/dashboard" />;
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    const formData = new FormData(event.currentTarget);
    formData.set("flow", flow);
    try {
      await signIn("password", formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10">
      <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-white/60 bg-white/90 p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
            ECM Platform
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            Manage engineering changes with auditability, approvals, and release control.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">
            This clean scaffold includes Convex Auth and the ECM route structure. The next steps
            add schema, backend workflows, and feature-complete pages.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <InfoCard label="Multi-tenant" value="Organizations + roles" />
            <InfoCard label="Workflow" value="CR / ECO state machine" />
            <InfoCard label="Traceability" value="Audit + approvals + comments" />
            <InfoCard label="Reporting" value="Dashboards + CSV export" />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            {flow === "signIn" ? "Sign in" : "Create account"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Use Convex Auth Password provider for local development.
          </p>

          <form className="mt-5 flex flex-col gap-3" onSubmit={(e) => void onSubmit(e)}>
            <label className="text-sm">
              <span className="mb-1 block text-slate-700">Email</span>
              <input
                autoComplete="email"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-0 focus:border-teal-600"
                name="email"
                placeholder="engineer@acme.com"
                type="email"
                required
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-slate-700">Password</span>
              <input
                autoComplete={flow === "signIn" ? "current-password" : "new-password"}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-0 focus:border-teal-600"
                name="password"
                placeholder="••••••••"
                type="password"
                required
              />
            </label>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            <button
              className="mt-1 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
              disabled={pending}
              type="submit"
            >
              {pending ? "Please wait..." : flow === "signIn" ? "Sign in" : "Create account"}
            </button>
          </form>

          <button
            className="mt-4 text-sm text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-slate-900"
            onClick={() => setFlow((current) => (current === "signIn" ? "signUp" : "signIn"))}
            type="button"
          >
            {flow === "signIn" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            After authentication, continue to a placeholder org route:{" "}
            <Link className="font-medium text-teal-700" to="/org/default/dashboard">
              /org/default/dashboard
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
