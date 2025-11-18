"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X, User } from "lucide-react";
import { browserLogger } from "@/lib/browser-logger";
import posthog from "posthog-js";
import { frontendPostHogManager } from "@/lib/frontend-posthog-manager";

interface UserIdentityProps {
  webSdkAdvancedConfig: string;
  selectedFlag: string;
  bootstrapDistinctId?: string;
}

export function UserIdentity({ webSdkAdvancedConfig, selectedFlag, bootstrapDistinctId }: UserIdentityProps) {
  const [distinctId, setDistinctId] = useState<string>("");
  const [personProperties, setPersonProperties] = useState<Record<string, string | number | boolean>>({});
  const [newPropertyKey, setNewPropertyKey] = useState<string>("");
  const [newPropertyValue, setNewPropertyValue] = useState<string>("");
  const [isIdentified, setIsIdentified] = useState(false);

  // PostHog Info state
  const [currentDistinctId, setCurrentDistinctId] = useState<string>("");
  const [featureFlagValue, setFeatureFlagValue] = useState<string | boolean | undefined>(undefined);

  // Update PostHog info function
  const updatePostHogInfo = () => {
    const postHogDistinctId = posthog.get_distinct_id();

    // Debug logging to understand what's happening
    browserLogger.debug(`UserIdentity: posthog.get_distinct_id() returned: "${postHogDistinctId}"`, 'general');
    browserLogger.debug(`UserIdentity: bootstrapDistinctId prop: "${bootstrapDistinctId}"`, 'general');

    // Use bootstrap distinct_id if provided and available, otherwise fall back to PostHog's value
    const effectiveDistinctId = (bootstrapDistinctId && bootstrapDistinctId.trim()) ?
      bootstrapDistinctId.trim() : postHogDistinctId;

    setCurrentDistinctId(effectiveDistinctId || "Not initialized");

    // Check identification status based on distinct_id change
    // Anonymous users get a UUID like "019a939f-d6dd-7ad3-ad82-63ea557ca3c8"
    // Identified users get the custom distinct_id they provided
    const isAnonymousId = effectiveDistinctId && effectiveDistinctId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    const isCurrentlyIdentified = !isAnonymousId;
    setIsIdentified(isCurrentlyIdentified);

    // Get flag value
    try {
      const flagValue = posthog.getFeatureFlag(selectedFlag);
      setFeatureFlagValue(flagValue);
    } catch (error) {
      setFeatureFlagValue(undefined);
    }
  };

  // Initial load and listen for flag updates only
  useEffect(() => {
    // Initial update when component mounts or selectedFlag changes
    updatePostHogInfo();

    // Special case for bootstrap scenarios: PostHog may be initializing with bootstrap data
    // but onFeatureFlags won't fire since flags are already loaded. Add multiple retries to
    // catch the final PostHog state after bootstrap initialization completes.
    const bootstrapCheckTimer1 = setTimeout(() => {
      updatePostHogInfo();
    }, 300);

    const bootstrapCheckTimer2 = setTimeout(() => {
      updatePostHogInfo();
    }, 800);

    const bootstrapCheckTimer3 = setTimeout(() => {
      updatePostHogInfo();
    }, 1500);

    // Listen for PostHog flag updates (fired when flags load or reload)
    const handleFlagUpdate = () => {
      updatePostHogInfo();
    };

    posthog.onFeatureFlags(handleFlagUpdate);

    // No polling - we'll update after identify() is called
    return () => {
      clearTimeout(bootstrapCheckTimer1);
      clearTimeout(bootstrapCheckTimer2);
      clearTimeout(bootstrapCheckTimer3);
      // PostHog doesn't provide a way to remove onFeatureFlags listener
    };
  }, [selectedFlag, bootstrapDistinctId]);

  // Component resets automatically on app restart due to parent remounting

  const handleAddProperty = () => {
    if (newPropertyKey.trim() && newPropertyValue.trim()) {
      const key = newPropertyKey.trim();
      const value = newPropertyValue.trim();

      setPersonProperties((prev) => ({
        ...prev,
        [key]: value,
      }));

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

  const handleIdentify = async () => {
    if (!distinctId.trim()) {
      browserLogger.warn('Cannot identify without distinct ID', 'identification');
      return;
    }

    const finalDistinctId = distinctId.trim();
    browserLogger.info(`🔄 Identifying user: ${finalDistinctId}`, 'identification');

    try {
      // Call PostHog identify directly - let PostHog handle flag behavior natively
      browserLogger.debug(`About to call posthog.identify("${finalDistinctId}", ${JSON.stringify(personProperties)})`, 'identification');
      posthog.identify(finalDistinctId, personProperties);

      // Update our state immediately after identify
      updatePostHogInfo();

      // Check PostHog state and log for debugging
      setTimeout(() => {
        const newDistinctId = posthog.get_distinct_id();
        const isIdentified = posthog.get_property('$is_identified');
        const flagValue = posthog.getFeatureFlag(selectedFlag);

        browserLogger.debug(`After identify: distinct_id="${newDistinctId}", $is_identified=${isIdentified}`, 'identification');
        browserLogger.debug(`Flag value for ${selectedFlag}: ${flagValue}`, 'identification');

        // Force a flag reload (PostHog should do this automatically, but just in case)
        browserLogger.info('🔄 Attempting to force flag reload...', 'identification');
        try {
          posthog.reloadFeatureFlags();
          browserLogger.success('Flag reload triggered', 'identification');
          // Update again after reload
          setTimeout(() => updatePostHogInfo(), 100);
        } catch (error) {
          browserLogger.error(`Flag reload failed: ${error}`, 'identification');
        }
      }, 100);

      // Log what PostHog will do based on its configuration
      if (webSdkAdvancedConfig === 'disable-flags') {
        browserLogger.warn('PostHog cannot call for flags (advanced_disable_flags: true)', 'flag-call');
      } else if (webSdkAdvancedConfig === 'disable-on-first-load') {
        browserLogger.info('PostHog will load flags now due to identify() call', 'flag-call');
        browserLogger.info('(advanced_disable_feature_flags_on_first_load: true)', 'flag-call');
      } else {
        browserLogger.info('PostHog will handle flag reloading based on its configuration', 'flag-call');
      }

      browserLogger.success(`✅ User identified: ${finalDistinctId} with ${Object.keys(personProperties).length} properties`, 'identification');

      // Track the identification event
      posthog.capture('demo_user_identified', {
        distinct_id: finalDistinctId,
        property_count: Object.keys(personProperties).length,
        web_sdk_config: webSdkAdvancedConfig,
      });

    } catch (error) {
      browserLogger.error(`Failed to identify user: ${String(error)}`, 'identification');
    }
  };

  return (
    <Card className="h-full flex flex-col" data-testid="user-identity">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <User className="h-5 w-5" />
          User Identity
        </CardTitle>
        {webSdkAdvancedConfig === 'disable-flags' && (
          <div className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-950 p-2 rounded border">
            ℹ️ advanced_disable_flags=true - PostHog will identify users but won't call for flags
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 space-y-4 overflow-auto">

        {/* Distinct ID Input */}
        <div className="space-y-2">
          <Label htmlFor="user-distinct-id">Distinct ID:</Label>
          <Input
            id="user-distinct-id"
            type="text"
            placeholder="Enter user ID (e.g., user123)"
            value={distinctId}
            onChange={(e) => setDistinctId(e.target.value)}
          />
        </div>

        {/* Person Properties */}
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

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleIdentify}
            disabled={!distinctId.trim()}
            className="w-full"
            variant="default"
          >
            Identify User
          </Button>
        </div>

        {/* PostHog Info */}
        <div className="p-3 bg-muted/50 rounded-md space-y-2" data-testid="posthog-status">
          <div className="text-sm font-medium mb-2">PostHog Status:</div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Distinct ID:</span>
            <span className="font-mono text-xs">{currentDistinctId || "Not initialized"}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Is Identified:</span>
            <span className={isIdentified ? "text-green-600" : "text-amber-600"}>
              {isIdentified ? "Yes" : "No"}
            </span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Flag ({selectedFlag}):</span>
            <span className="font-mono text-xs" data-testid="flag-value">
              {featureFlagValue === undefined
                ? "not set"
                : String(featureFlagValue)}
            </span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Evaluation:</span>
            <span className="text-xs">
              {webSdkAdvancedConfig === 'disable-flags'
                ? "Flags disabled"
                : "PostHog"}
            </span>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}