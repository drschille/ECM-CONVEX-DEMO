import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convexApi";
import { fmtDate } from "@/lib/ecm";

type Props = {
  organizationId: string;
  entityType: "changeRequest" | "eco";
  entityId: string;
};

export function CommentsThread({ organizationId, entityType, entityId }: Props) {
  const comments = useQuery(api.comments.listForEntity, {
    organizationId: organizationId as any,
    entityType,
    entityId,
  });
  const members = useQuery(api.organizations.listMembers, {
    organizationId: organizationId as any,
  });
  const addComment = useMutation(api.comments.add);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const mentionToken = useMemo(() => {
    const match = body.match(/@([a-zA-Z0-9._-]*)$/);
    return match?.[1]?.toLowerCase() ?? null;
  }, [body]);

  const suggestions =
    mentionToken && members
      ? members
          .filter((m: any) => {
            const emailUser = String(m.email).split("@")[0].toLowerCase();
            return (
              emailUser.includes(mentionToken) ||
              String(m.name).toLowerCase().includes(mentionToken)
            );
          })
          .slice(0, 5)
      : [];

  const submit = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await addComment({ organizationId: organizationId as any, entityType, entityId, body: trimmed });
      setBody("");
    } finally {
      setBusy(false);
    }
  };

  const applyMention = (member: any) => {
    const emailUser = String(member.email).split("@")[0];
    setBody((current) => current.replace(/@([a-zA-Z0-9._-]*)$/, `@${emailUser} `));
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Comments</h3>
        <span className="text-xs text-slate-500">{comments?.length ?? 0}</span>
      </div>

      <div className="space-y-2">
        {(comments ?? []).map((comment: any) => (
          <article key={comment._id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{fmtDate(comment.createdAt)}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{comment.body}</p>
          </article>
        ))}
      </div>

      <div className="mt-3">
        <textarea
          className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add comment... Use @name to mention users."
          value={body}
        />
        {suggestions.length > 0 && (
          <div className="mt-2 rounded-lg border border-slate-200 bg-white p-1">
            {suggestions.map((member: any) => (
              <button
                key={member.profileId}
                className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-slate-100"
                onClick={() => applyMention(member)}
                type="button"
              >
                {member.name} ({member.email})
              </button>
            ))}
          </div>
        )}
        <div className="mt-2 flex justify-end">
          <button
            className="rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
            disabled={busy || !body.trim()}
            onClick={() => void submit()}
            type="button"
          >
            {busy ? "Posting..." : "Post comment"}
          </button>
        </div>
      </div>
    </section>
  );
}
