"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RotateCcw, Plus, X } from "lucide-react";
import posthog from "posthog-js";
import { browserLogger } from "@/lib/browser-logger";
import { frontendPostHogManager } from "@/lib/frontend-posthog-manager";

interface FeatureFlag {
  key: string;
  name: string;
  active: boolean;
}

interface FlagEvaluationFormProps {
  selectedFlag: string;
  onFlagChange: (flag: string) => void;
  onEvaluationMethodChange?: (method: string) => void;
}

export function FlagEvaluationForm({
  selectedFlag,
  onFlagChange,
  onEvaluationMethodChange,
}: FlagEvaluationFormProps) {
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [isLoadingFlags, setIsLoadingFlags] = useState<boolean>(true);
  const [evaluationMethod, setEvaluationMethod] = useState<string>("client-side");
  const [onlyEvaluateLocally, setOnlyEvaluateLocally] = useState<string>("false");
  const [distinctId, setDistinctId] = useState<string>("");
  const [personProperties, setPersonProperties] = useState<Record<string, string | number | boolean>>({});
  const [newPropertyKey, setNewPropertyKey] = useState<string>("");
  const [newPropertyValue, setNewPropertyValue] = useState<string>("");

  // Fetch feature flags on mount
  useEffect(() => {
    const fetchFlags = async () => {
      try {
        const response = await fetch("/api/feature-flags");
        if (!response.ok) {
          throw new Error("Failed to fetch feature flags");
        }
        const data = await response.json();
        setFeatureFlags(data.flags);
      } catch (error) {
        console.error("Error fetching feature flags:", error);
      } finally {
        setIsLoadingFlags(false);
      }
    };

    fetchFlags();

    // Initialize frontend PostHog manager
    frontendPostHogManager.switchMode('client-side-flags');
  }, []);

  // Switch PostHog mode when evaluation method changes
  useEffect(() => {
    const mode = evaluationMethod === 'client-side' ? 'client-side-flags' : 'server-side-flags';
    frontendPostHogManager.switchMode(mode);
  }, [evaluationMethod]);

  const handleAddProperty = () => {
    if (newPropertyKey.trim() && newPropertyValue.trim()) {
      const key = newPropertyKey.trim();
      const value = newPropertyValue.trim();

      setPersonProperties((prev) => ({
        ...prev,
        [key]: value,
      }));

      // Track person property addition
      posthog.capture('person_property_added', {
        property_key: key,
        property_value_type: typeof value,
        total_properties: Object.keys(personProperties).length + 1,
      });

      setNewPropertyKey("");
      setNewPropertyValue("");
    }
  };

  const handleRemoveProperty = (key: string) => {
    setPersonProperties((prev) => {
      const newProps = { ...prev };
      delete newProps[key];
      return newProps;
    });
  };

  // New function for client-side: identify user and immediately refresh flags
  const handleIdentifyAndEvaluate = async () => {
    const finalDistinctId = distinctId || "anonymous";

    if (distinctId) {
      // Identify the user with properties
      browserLogger.info(`Identifying user: ${distinctId}`, 'identification');
      frontendPostHogManager.identify(distinctId, personProperties);
      browserLogger.success(`User identified with ${Object.keys(personProperties).length} properties`, 'identification');

      // Track user identification event
      frontendPostHogManager.capture('user_identified', {
        distinct_id: distinctId,
        property_count: Object.keys(personProperties).length,
        evaluation_mode: evaluationMethod,
      });
    } else {
      browserLogger.info('Using anonymous user (no distinct ID provided)', 'identification');
    }

    // Auto-refresh flags after identification (client-side only)
    browserLogger.info('Auto-refreshing flags after identification...', 'flag-call');
    await frontendPostHogManager.reloadFlags();
  };

  const handleEvaluateFlags = async () => {
    // For server evaluation, use the distinctId from form or fallback to PostHog's ID
    const finalDistinctId = distinctId || posthog.get_distinct_id();

    const payload = {
      distinctId: finalDistinctId,
      personProperties,
      evaluationMethod,
      onlyEvaluateLocally: onlyEvaluateLocally === "true"
    };

    browserLogger.info(`Calling for flags (method: ${evaluationMethod}, distinctId: ${finalDistinctId})`, 'flag-call');

    // Track flag evaluation event only in client-side mode
    if (evaluationMethod === "client-side") {
      posthog.capture('feature_flag_evaluated', {
        evaluation_method: evaluationMethod,
        only_evaluate_locally: onlyEvaluateLocally === "true",
        selected_flag: selectedFlag,
        property_count: Object.keys(personProperties).length,
        distinct_id: finalDistinctId,
      });
    }

    try {
      const response = await fetch("/api/evaluate-flags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to evaluate flags");
      }

      const data = await response.json();

      if (evaluationMethod === "client-side") {
        browserLogger.info("Client-side evaluation completed", 'flag-evaluation');
      } else {
        const flagCount = data.flags ? Object.keys(data.flags).length : 0;
        const flagValue = data.flags && selectedFlag ? data.flags[selectedFlag] : 'undefined';
        browserLogger.success(`Received ${flagCount} flags from server for ${finalDistinctId}`, 'flag-payload');
        browserLogger.info(`Selected flag "${selectedFlag}": ${flagValue}`, 'flag-payload');

        // Store server flags in frontend manager and apply overrides
        if (data.flags) {
          frontendPostHogManager.updateServerFlags(data.flags, finalDistinctId, selectedFlag);
          browserLogger.debug(`All flags: ${JSON.stringify(data.flags)}`, 'flag-payload');
        }
      }

      console.log("Flag evaluation result:", data);
    } catch (error) {
      browserLogger.error(`Error evaluating flags: ${String(error)}`, 'flag-evaluation');
      console.error("Error evaluating flags:", error);
    }
  };

  const handleRefreshFlags = async () => {
    const startTime = performance.now();

    try {
      await frontendPostHogManager.reloadFlags();
      const elapsedTime = Math.round(performance.now() - startTime);

      console.log(`Feature flags refreshed successfully in ${elapsedTime}ms`);

      // Track successful flag refresh
      frontendPostHogManager.capture('feature_flags_refreshed', {
        duration_ms: elapsedTime,
        selected_flag: selectedFlag,
        success: true,
        evaluation_mode: evaluationMethod,
      });

      // Log to terminal via API only for client-side evaluation
      if (evaluationMethod === "client-side") {
        await fetch('/api/emit-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level: 'success',
            message: `Client-side flags refreshed in ${elapsedTime}ms`
          }),
        });
      }
    } catch (error) {
      const elapsedTime = Math.round(performance.now() - startTime);
      browserLogger.error(`Error refreshing feature flags after ${elapsedTime}ms: ${String(error)}`, 'flag-call');
      console.error(`Error refreshing feature flags after ${elapsedTime}ms:`, error);

      // Track failed flag refresh
      frontendPostHogManager.capture('feature_flags_refreshed', {
        duration_ms: elapsedTime,
        selected_flag: selectedFlag,
        success: false,
        error: String(error),
        evaluation_mode: evaluationMethod,
      });

      // Capture the error for error tracking
      posthog.captureException(error);

      // Log error to terminal via API
      await fetch('/api/emit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'error',
          message: `Error refreshing flags after ${elapsedTime}ms: ${String(error)}`
        }),
      });
    }
  };

  const handleResetDistinctId = async () => {
    try {
      const oldDistinctId = posthog.get_distinct_id();

      // Reset both PostHog and our frontend manager
      posthog.reset();
      const newDistinctId = posthog.get_distinct_id();

      // Re-initialize frontend manager with current mode
      const mode = evaluationMethod === 'client-side' ? 'client-side-flags' : 'server-side-flags';
      await frontendPostHogManager.switchMode(mode);

      browserLogger.info(`Distinct ID reset: ${oldDistinctId} → ${newDistinctId}`, 'identification');
      console.log(`Distinct ID reset from ${oldDistinctId} to ${newDistinctId}`);

      // Track distinct ID reset
      frontendPostHogManager.capture('distinct_id_reset', {
        old_distinct_id: oldDistinctId,
        new_distinct_id: newDistinctId,
        evaluation_mode: evaluationMethod,
      });

      // Log to terminal via API
      await fetch('/api/emit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'info',
          message: `Reset distinct ID: ${oldDistinctId} → ${newDistinctId}`
        }),
      });

      // Clear the distinct ID and properties
      setDistinctId('');
      setPersonProperties({});

      // If in client-side mode, refresh flags to show anonymous experience
      if (evaluationMethod === "client-side") {
        browserLogger.info('Refreshing flags for anonymous user...', 'flag-call');
        await frontendPostHogManager.reloadFlags();
        browserLogger.success('Flags refreshed for anonymous user', 'flag-call');
      }
    } catch (error) {
      console.error('Error resetting distinct ID:', error);

      // Capture error for error tracking
      posthog.captureException(error);

      await fetch('/api/emit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'error',
          message: `Error resetting distinct ID: ${String(error)}`
        }),
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Flag Evaluation Settings</CardTitle>
        <CardDescription>
          {evaluationMethod === "client-side"
            ? "Flags evaluated directly by PostHog client SDK in browser"
            : evaluationMethod === "server-side"
            ? "Send user data to server → Server calls PostHog API → Returns flags to client"
            : "Server evaluates flags locally using cached definitions → Returns flags to client"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="feature-flag">Feature Flag:</Label>
          <Select value={selectedFlag} onValueChange={(value) => {
            onFlagChange(value);
            browserLogger.info(`Selected feature flag: ${value}`, 'flag-switch');
            // Track feature flag change
            frontendPostHogManager.capture('feature_flag_changed', {
              previous_flag: selectedFlag,
              new_flag: value,
              evaluation_mode: evaluationMethod,
            });
          }}>
            <SelectTrigger id="feature-flag" className="w-full">
              <SelectValue placeholder={isLoadingFlags ? "Loading..." : "Select a feature flag"} />
            </SelectTrigger>
            <SelectContent>
              {isLoadingFlags ? (
                <SelectItem value="loading" disabled>
                  Loading flags...
                </SelectItem>
              ) : featureFlags.length === 0 ? (
                <SelectItem value="none" disabled>
                  No flags found
                </SelectItem>
              ) : (
                featureFlags.map((flag) => (
                  <SelectItem key={flag.key} value={flag.key}>
                    {flag.name} ({flag.key}) {!flag.active && "- Inactive"}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="distinct-id">Distinct ID:</Label>
          <div className="flex gap-2">
            <Input
              id="distinct-id"
              type="text"
              placeholder={evaluationMethod === "client-side" ? "Enter user ID (or leave empty for anonymous)" : "Enter user ID for server evaluation"}
              value={distinctId}
              onChange={(e) => setDistinctId(e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleResetDistinctId}
              title="Reset to anonymous"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="evaluation-method">Flag evaluation method:</Label>
            <Select value={evaluationMethod} onValueChange={(value) => {
              setEvaluationMethod(value);
              onEvaluationMethodChange?.(value);
              browserLogger.info(`Switching flag evaluation method: ${evaluationMethod} → ${value}`, 'flag-switch');
              // Track evaluation method change (always track this as it affects the demo itself)
              frontendPostHogManager.capture('evaluation_method_changed', {
                previous_method: evaluationMethod,
                new_method: value,
              });
            }}>
              <SelectTrigger id="evaluation-method" className="w-full">
                <SelectValue placeholder="Select evaluation method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client-side">Client side</SelectItem>
                <SelectItem value="server-side">Server side</SelectItem>
                <SelectItem value="server-side-local">Server side local evaluation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="evaluate-locally">Only evaluate locally:</Label>
            <Select
              value={onlyEvaluateLocally}
              onValueChange={setOnlyEvaluateLocally}
              disabled={evaluationMethod === "client-side" || evaluationMethod === "server-side"}
            >
              <SelectTrigger id="evaluate-locally" className="w-full">
                <SelectValue placeholder="Select option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">True</SelectItem>
                <SelectItem value="false">False</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Person Properties:</Label>
          {Object.keys(personProperties).length > 0 && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-md">
              {Object.entries(personProperties).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <div className="flex-1 flex items-center gap-2 text-sm">
                    <span className="font-medium">{key}:</span>
                    <span className="text-muted-foreground">{String(value)}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleRemoveProperty(key)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="Property key"
              value={newPropertyKey}
              onChange={(e) => setNewPropertyKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddProperty()}
            />
            <Input
              placeholder="Property value"
              value={newPropertyValue}
              onChange={(e) => setNewPropertyValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddProperty()}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleAddProperty}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button
            onClick={evaluationMethod === "client-side" ? handleIdentifyAndEvaluate : handleEvaluateFlags}
            className="flex-1"
            variant="default"
          >
            {evaluationMethod === "client-side" ? "Identify User & Get Flags" : "Get Flags from Server"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
