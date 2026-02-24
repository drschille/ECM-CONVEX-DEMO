import { statusOrder } from "@/lib/ecm";
import { classNames } from "@/lib/ecm";

export function WorkflowStepper({ status }: { status: string }) {
  const currentIndex = statusOrder.indexOf(status as (typeof statusOrder)[number]);
  return (
    <ol className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
      {statusOrder.map((step, index) => {
        const complete = currentIndex >= 0 && index <= currentIndex;
        const active = step === status;
        return (
          <li
            key={step}
            className={classNames(
              "rounded-lg border px-2 py-2 text-center text-xs",
              active
                ? "border-teal-600 bg-teal-50 text-teal-800"
                : complete
                  ? "border-teal-200 bg-white text-slate-700"
                  : "border-slate-200 bg-slate-50 text-slate-500",
            )}
          >
            {step.replace(/_/g, " ")}
          </li>
        );
      })}
    </ol>
  );
}
