import type { SequencePrefixType } from "../types/ecm";

export default function AdminSetupPage({
  prefixDrafts,
  onPrefixChange,
  onSavePrefix,
  onResetToDefault,
  suggestedRequestId,
  suggestedNotificationId,
  savingPrefixFor,
  error,
  status,
  defaults,
}: {
  prefixDrafts: Record<SequencePrefixType, string>;
  onPrefixChange: (sequenceType: SequencePrefixType, value: string) => void;
  onSavePrefix: (sequenceType: SequencePrefixType) => void;
  onResetToDefault: (sequenceType: SequencePrefixType) => void;
  suggestedRequestId: string | undefined;
  suggestedNotificationId: string | undefined;
  savingPrefixFor: SequencePrefixType | null;
  error: string | null;
  status: string | null;
  defaults: Record<SequencePrefixType, string>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Sequence Prefix Setup
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Configure request and notification ID prefixes independently.
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
          Prefix format: 1-6 letters (A-Z)
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SequencePrefixCard
          title="Change Requests"
          sequenceType="changeRequest"
          value={prefixDrafts.changeRequest}
          defaultValue={defaults.changeRequest}
          nextId={suggestedRequestId}
          isSaving={savingPrefixFor === "changeRequest"}
          onChange={(value) => onPrefixChange("changeRequest", value)}
          onSave={() => onSavePrefix("changeRequest")}
          onResetToDefault={() => onResetToDefault("changeRequest")}
        />
        <SequencePrefixCard
          title="Change Notifications"
          sequenceType="changeNotification"
          value={prefixDrafts.changeNotification}
          defaultValue={defaults.changeNotification}
          nextId={suggestedNotificationId}
          isSaving={savingPrefixFor === "changeNotification"}
          onChange={(value) => onPrefixChange("changeNotification", value)}
          onSave={() => onSavePrefix("changeNotification")}
          onResetToDefault={() => onResetToDefault("changeNotification")}
        />
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-900 dark:text-red-100">
          {error}
        </div>
      )}
      {status && (
        <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-900 dark:text-emerald-100">
          {status}
        </div>
      )}
    </section>
  );
}

function SequencePrefixCard({
  title,
  sequenceType,
  value,
  defaultValue,
  nextId,
  isSaving,
  onChange,
  onSave,
  onResetToDefault,
}: {
  title: string;
  sequenceType: SequencePrefixType;
  value: string;
  defaultValue: string;
  nextId: string | undefined;
  isSaving: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onResetToDefault: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Sequence key: <span className="font-mono">{sequenceType}</span>
          </p>
        </div>
        <button
          className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          onClick={onResetToDefault}
          type="button"
        >
          Reset ({defaultValue})
        </button>
      </div>

      <label className="mt-3 flex flex-col gap-1 text-sm">
        <span className="text-slate-700 dark:text-slate-200">Prefix</span>
        <input
          className="rounded-md border border-slate-300 bg-white p-2 font-mono uppercase text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          maxLength={6}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder={defaultValue}
          value={value}
        />
      </label>

      <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-950">
        <p className="text-slate-600 dark:text-slate-300">Next generated ID preview</p>
        <p className="mt-1 font-mono text-slate-900 dark:text-slate-100">
          {nextId ?? "Loading..."}
        </p>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          disabled={isSaving}
          onClick={onSave}
          type="button"
        >
          {isSaving ? "Saving..." : "Save Prefix"}
        </button>
      </div>
    </div>
  );
}
