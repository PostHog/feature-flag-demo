"use client";

import { PostHogInfoCard } from "@/components/posthog-info-card";
import { FlagEvaluationForm } from "@/components/flag-evaluation-form";

interface PaneOneProps {
  selectedFlag: string;
  onFlagChange: (flag: string) => void;
}

export function PaneOne({ selectedFlag, onFlagChange }: PaneOneProps) {
  return (
    <div className="flex h-full flex-col gap-6 overflow-auto">
      <PostHogInfoCard selectedFlag={selectedFlag} />
      <FlagEvaluationForm
        selectedFlag={selectedFlag}
        onFlagChange={onFlagChange}
      />
    </div>
  );
}
