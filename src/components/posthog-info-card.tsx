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
  compact?: boolean;
}

export function PostHogInfoCard({ selectedFlag, compact = false }: PostHogInfoCardProps) {
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

      // Check identification status based on distinct_id change
      // Anonymous users get a UUID like "019a939f-d6dd-7ad3-ad82-63ea557ca3c8"
      // Identified users get the custom distinct_id they provided
      const isAnonymousId = distinctId && distinctId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      const isIdentified = !isAnonymousId;

      // Debug identification detection using browser logger
      if (typeof window !== 'undefined' && (window as any).browserLogger) {
        (window as any).browserLogger.debug(`Identification debug: distinctId="${distinctId}", isAnonymousId=${!!isAnonymousId}, isIdentified=${isIdentified}`, 'posthog-info');
      }

      // Get flag value directly from PostHog
      let featureFlagValue: string | boolean | undefined;
      let evaluationReason: string = "PostHog";

      try {
        featureFlagValue = posthog.getFeatureFlag(selectedFlag);
      } catch (error) {
        featureFlagValue = undefined;
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

    // Listen for PostHog flag updates and poll for changes
    posthog.onFeatureFlags(updateInfo);
    const intervalId = setInterval(updateInfo, 200);

    // Cleanup
    return () => {
      clearInterval(intervalId);
    };
  }, [selectedFlag]);

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
