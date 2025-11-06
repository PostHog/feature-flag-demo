"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PostHogInfo {
  distinctId: string;
  isIdentified: boolean;
  featureFlagValue: string | boolean | undefined;
  evaluationMethod: string;
}

export function PostHogInfoCard() {
  const [info, setInfo] = useState<PostHogInfo>({
    distinctId: "",
    isIdentified: false,
    featureFlagValue: undefined,
    evaluationMethod: "loading...",
  });

  useEffect(() => {
    // Wait for PostHog to be ready
    const updateInfo = () => {
      const distinctId = posthog.get_distinct_id();
      const isIdentified = posthog.get_property("$is_identified") === true;
      const featureFlagValue = posthog.getFeatureFlag("new-ui-flow");

      // Get feature flag evaluation details
      const featureFlagPayload = posthog.getFeatureFlagPayload("new-ui-flow");
      const evaluationReason = 'local evaluation';

      setInfo({
        distinctId,
        isIdentified,
        featureFlagValue,
        evaluationMethod: evaluationReason,
      });
    };

    // Initial update
    updateInfo();

    // Listen for feature flag updates
    posthog.onFeatureFlags(updateInfo);

    // Cleanup
    return () => {
      // PostHog doesn't provide an off method for onFeatureFlags
    };
  }, []);

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
          <span className="font-medium">Feature Flag (new-ui-flow):</span>
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
