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
import { frontendPostHogManager } from "@/lib/frontend-posthog-manager";
import { browserLogger } from "@/lib/browser-logger";

interface FeatureFlagDemoProps {
  selectedFlag: string;
  evaluationMethod: string;
}

export function FeatureFlagDemo({ selectedFlag, evaluationMethod }: FeatureFlagDemoProps) {
  const [isNewUI, setIsNewUI] = useState(false);

  useEffect(() => {
    let lastFlagValue: boolean | null = null;

    // Check flag value and update UI
    const updateUI = () => {
      let flagValue: boolean = false;

      try {
        if (evaluationMethod === "client-side") {
          flagValue = posthog.isFeatureEnabled(selectedFlag);
        } else {
          // In server-side modes, get flag from frontend manager
          const rawValue = frontendPostHogManager.getFeatureFlag(selectedFlag);
          flagValue = rawValue === true || rawValue === "true";
        }

        // Only log and update if the value actually changed
        if (lastFlagValue !== flagValue) {
          lastFlagValue = flagValue;
          browserLogger.info(`UI update: ${selectedFlag} = ${flagValue}, switching to ${flagValue ? 'new' : 'old'} UI`, 'flag-evaluation');
          setIsNewUI(flagValue);
        }
      } catch (error) {
        browserLogger.error(`Error checking flag ${selectedFlag}: ${String(error)}`, 'flag-evaluation');
        setIsNewUI(false);
      }
    };

    // Initial check
    updateUI();

    // Listen for flag changes (only in client-side mode)
    if (evaluationMethod === "client-side") {
      posthog.onFeatureFlags(updateUI);
    } else {
      // Poll for changes in server-side mode, but less frequently
      const intervalId = setInterval(updateUI, 2000);
      return () => {
        clearInterval(intervalId);
      };
    }

    // No cleanup needed for client-side mode
    return () => {};
  }, [selectedFlag, evaluationMethod]);

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
