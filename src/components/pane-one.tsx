"use client";

import { useState } from "react";
import { PostHogInfoCard } from "@/components/posthog-info-card";
import { FlagEvaluationForm } from "@/components/flag-evaluation-form";
import { BrowserConsole } from "@/components/browser-console";

interface PaneOneProps {
  selectedFlag: string;
  onFlagChange: (flag: string) => void;
  evaluationMethod: string;
  onEvaluationMethodChange: (method: string) => void;
}

export function PaneOne({ selectedFlag, onFlagChange, evaluationMethod, onEvaluationMethodChange }: PaneOneProps) {

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto">
      <PostHogInfoCard
        selectedFlag={selectedFlag}
        evaluationMethod={evaluationMethod}
      />
      <FlagEvaluationForm
        selectedFlag={selectedFlag}
        onFlagChange={onFlagChange}
        onEvaluationMethodChange={onEvaluationMethodChange}
      />
      <BrowserConsole />
    </div>
  );
}
