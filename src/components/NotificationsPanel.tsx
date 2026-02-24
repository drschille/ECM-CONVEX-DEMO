import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/lib/convexApi";
import { fmtDate } from "@/lib/ecm";

export function NotificationsPanel({ organizationId }: { organizationId?: string }) {
  const [open, setOpen] = useState(false);
  const unreadCount = useQuery(api.notifications.unreadCount, {
    organizationId: organizationId as any,
  });
  const notifications = useQuery(api.notifications.listMine, {
    organizationId: organizationId as any,
    unreadOnly: false,
    paginationOpts: { numItems: 20, cursor: null },
  });
  const markRead = useMutation(api.notifications.markRead);
  const markAll = useMutation(api.notifications.markAllReadForOrg);

  return (
    <div className="relative">
      <button
        className="relative rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        Notifications
        {(unreadCount ?? 0) > 0 && (
          <span className="ml-2 rounded-full bg-rose-600 px-1.5 py-0.5 text-xs text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[22rem] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            {organizationId && (
              <button
                className="text-xs text-teal-700 hover:underline"
                onClick={() => void markAll({ organizationId: organizationId as any })}
                type="button"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 space-y-2 overflow-auto">
            {(notifications?.page ?? []).length === 0 && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                No notifications.
              </p>
            )}
            {(notifications?.page ?? []).map((n: any) => (
              <button
                key={n._id}
                className={`block w-full rounded-lg border px-3 py-2 text-left ${
                  n.isRead ? "border-slate-200 bg-white" : "border-teal-200 bg-teal-50/50"
                }`}
                onClick={() => void markRead({ notificationId: n._id })}
                type="button"
              >
                <p className="text-xs font-semibold text-slate-900">{n.title}</p>
                <p className="mt-1 text-xs text-slate-600">{n.body}</p>
                <p className="mt-1 text-[11px] text-slate-500">{fmtDate(n.createdAt)}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
