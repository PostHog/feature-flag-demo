import { PostHogInfoCard } from "@/components/posthog-info-card";
import { FlagEvaluationForm } from "@/components/flag-evaluation-form";

export function PaneOne() {
  return (
    <div className="flex h-full flex-col p-6 gap-6 overflow-auto">
      <PostHogInfoCard />
      <FlagEvaluationForm />
    </div>
  );
}
