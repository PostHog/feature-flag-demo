"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import posthog from "posthog-js";

interface FeatureFlagDemoProps {
  selectedFlag: string;
}

export function FeatureFlagDemo({ selectedFlag }: FeatureFlagDemoProps) {
  const [isNewUI, setIsNewUI] = useState(false);

  useEffect(() => {
    // Listen for feature flag changes (including initial load)
    const handleFlagChange = () => {
      const flagValue = posthog.isFeatureEnabled(selectedFlag);
      setIsNewUI(flagValue === true);
    };

    // onFeatureFlags callback is triggered when flags are loaded, including initial load
    posthog.onFeatureFlags(handleFlagChange);

    // Cleanup listener on unmount
    return () => {
      // PostHog doesn't have a direct way to remove listeners, but this ensures cleanup
    };
  }, [selectedFlag]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Feature Flag Demo</CardTitle>
        <CardDescription>
          UI changes based on the {selectedFlag} feature flag
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isNewUI ? (
          <div className="p-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg text-white">
            <h3 className="text-2xl font-bold mb-2">🎉 New UI</h3>
            <p className="text-lg">
              You&apos;re seeing the new, modern interface with enhanced
              features!
            </p>
            <div className="mt-4 flex gap-2">
              <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
              <div className="h-2 w-2 rounded-full bg-white animate-pulse delay-75" />
              <div className="h-2 w-2 rounded-full bg-white animate-pulse delay-150" />
            </div>
          </div>
        ) : (
          <div className="p-6 bg-gray-100 dark:bg-gray-800 rounded-lg border-2 border-gray-300 dark:border-gray-700">
            <h3 className="text-xl font-semibold mb-2">Old UI</h3>
            <p className="text-muted-foreground">
              This is the classic interface. Enable the {selectedFlag} flag to
              see the updated design.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
