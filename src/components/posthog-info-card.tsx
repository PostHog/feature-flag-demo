"use client";

import { useEffect, useState, useRef } from "react";
import posthog from "posthog-js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { frontendPostHogManager } from "@/lib/frontend-posthog-manager";

interface PostHogInfo {
  distinctId: string;
  isIdentified: boolean;
  featureFlagValue: string | boolean | undefined;
  evaluationMethod: string;
}

interface PostHogInfoCardProps {
  selectedFlag: string;
  evaluationMethod: string;
}

export function PostHogInfoCard({ selectedFlag, evaluationMethod }: PostHogInfoCardProps) {
  const [info, setInfo] = useState<PostHogInfo>({
    distinctId: "",
    isIdentified: false,
    featureFlagValue: undefined,
    evaluationMethod: "loading...",
  });
  const previousDistinctIdRef = useRef<string>("");

  useEffect(() => {
    // Wait for PostHog to be ready
    const updateInfo = () => {
      const distinctId = posthog.get_distinct_id();
      const isIdentified = posthog.get_property("$is_identified") === true;

      // Use frontend manager to get flag value based on evaluation mode
      let featureFlagValue: string | boolean | undefined;
      let evaluationReason: string;

      if (evaluationMethod === "client-side") {
        // Only call getFeatureFlag in client-side mode
        try {
          featureFlagValue = posthog.getFeatureFlag(selectedFlag);
        } catch (error) {
          featureFlagValue = undefined;
        }
        evaluationReason = "client-side";
      } else {
        // In server-side modes, get flag from stored server flags
        featureFlagValue = frontendPostHogManager.getFeatureFlag(selectedFlag);
        evaluationReason = evaluationMethod === "server-side-local" ? "server-side local" : "server-side";
      }

      // Only update if something changed
      if (distinctId !== previousDistinctIdRef.current) {
        previousDistinctIdRef.current = distinctId;
        setInfo({
          distinctId,
          isIdentified,
          featureFlagValue,
          evaluationMethod: evaluationReason,
        });
      } else {
        // Update other fields even if distinct ID didn't change
        setInfo((prev) => ({
          ...prev,
          isIdentified,
          featureFlagValue,
          evaluationMethod: evaluationReason,
        }));
      }
    };

    // Initial update
    updateInfo();

    // Listen for feature flag updates (only in client-side mode)
    if (evaluationMethod === "client-side") {
      posthog.onFeatureFlags(updateInfo);

      // Only poll in client-side mode for distinct ID changes
      const intervalId = setInterval(updateInfo, 200);

      // Cleanup
      return () => {
        clearInterval(intervalId);
      };
    } else {
      // In server-side modes, don't poll - just update when props change
      return () => {};
    }
  }, [selectedFlag, evaluationMethod]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>PostHog Info</CardTitle>
        <CardDescription>Current user and feature flag status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between">
          <span className="font-medium">Distinct ID:</span>
          <span className="font-mono text-sm">{info.distinctId}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Is Identified:</span>
          <span className={info.isIdentified ? "text-green-600" : "text-amber-600"}>
            {info.isIdentified ? "Yes" : "No"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Feature Flag ({selectedFlag}):</span>
          <span className="font-mono text-sm">
            {info.featureFlagValue === undefined
              ? "not set"
              : String(info.featureFlagValue)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Evaluation Method:</span>
          <span className="text-sm">{info.evaluationMethod}</span>
        </div>
      </CardContent>
    </Card>
  );
}
