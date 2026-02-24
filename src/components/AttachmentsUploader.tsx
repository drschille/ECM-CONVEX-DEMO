import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/lib/convexApi";
import { fmtDate } from "@/lib/ecm";

type Props = {
  organizationId: string;
  entityType: "changeRequest" | "eco";
  entityId: string;
};

export function AttachmentsUploader({ organizationId, entityType, entityId }: Props) {
  const attachments = useQuery(api.attachments.listForEntity, {
    organizationId: organizationId as any,
    entityType,
    entityId,
  });
  const getUploadUrl = useMutation(api.attachments.generateUploadUrl);
  const addAttachment = useMutation(api.attachments.add);
  const removeAttachment = useMutation(api.attachments.remove);
  const [busy, setBusy] = useState(false);

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const postUrl = await getUploadUrl({ organizationId: organizationId as any });
      const response = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      const json = (await response.json()) as { storageId: string };
      await addAttachment({
        organizationId: organizationId as any,
        entityType,
        entityId,
        storageId: json.storageId as any,
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });
      event.target.value = "";
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Attachments</h3>
        <label className="cursor-pointer rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700">
          {busy ? "Uploading..." : "Upload file"}
          <input
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              void onFileChange(e);
            }}
            type="file"
          />
        </label>
      </div>
      <div className="space-y-2">
        {(attachments ?? []).map((attachment: any) => (
          <div key={attachment._id} className="flex items-center justify-between rounded-lg border p-2 text-xs">
            <div>
              <a
                className="font-medium text-teal-700 hover:underline"
                href={attachment.downloadUrl ?? undefined}
                rel="noreferrer"
                target="_blank"
              >
                {attachment.fileName}
              </a>
              <p className="text-slate-500">{fmtDate(attachment.createdAt)}</p>
            </div>
            <button
              className="rounded border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-50"
              onClick={() =>
                void removeAttachment({
                  organizationId: organizationId as any,
                  attachmentId: attachment._id,
                })
              }
              type="button"
            >
              Remove
            </button>
          </div>
        ))}
        {(attachments ?? []).length === 0 && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">No attachments.</p>
        )}
      </div>
    </section>
  );
}
