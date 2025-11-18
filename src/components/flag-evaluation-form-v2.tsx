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
import { Plus, X, RotateCw } from "lucide-react";
import { browserLogger } from "@/lib/browser-logger";

interface FeatureFlag {
  key: string;
  name: string;
  active: boolean;
}

interface FlagEvaluationFormProps {
  selectedFlag: string;
  onFlagChange: (flag: string) => void;
  onEvaluationMethodChange?: (method: string) => void;
  onAppRestart?: (config: {
    evaluationMethod: string;
    webSdkAdvancedConfig: string;
    distinctId: string;
    personProperties: Record<string, any>;
    serverFlags: Record<string, any>;
    selectedFlag: string;
  }) => void;
}

export function FlagEvaluationForm({
  selectedFlag,
  onFlagChange,
  onEvaluationMethodChange,
  onAppRestart,
}: FlagEvaluationFormProps) {
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [isLoadingFlags, setIsLoadingFlags] = useState<boolean>(true);

  // Form state - changes don't trigger restart
  const [evaluationMethod, setEvaluationMethod] = useState<string>("client-side");
  const [onlyEvaluateLocally, setOnlyEvaluateLocally] = useState<string>("false");
  const [webSdkAdvancedConfig, setWebSdkAdvancedConfig] = useState<string>("default");

  // Server mode inputs (simulating server-side data)
  const [serverDistinctId, setServerDistinctId] = useState<string>("");
  const [serverProperties, setServerProperties] = useState<Record<string, string | number | boolean>>({});
  const [newPropertyKey, setNewPropertyKey] = useState<string>("");
  const [newPropertyValue, setNewPropertyValue] = useState<string>("");

  // Loading state for server calls
  const [isEvaluatingFlags, setIsEvaluatingFlags] = useState(false);

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
  }, []);

  const handleAddProperty = () => {
    if (newPropertyKey.trim() && newPropertyValue.trim()) {
      const key = newPropertyKey.trim();
      const value = newPropertyValue.trim();

      setServerProperties((prev) => ({
        ...prev,
        [key]: value,
      }));

      setNewPropertyKey("");
      setNewPropertyValue("");
    }
  };

  const handleRemoveProperty = (key: string) => {
    setServerProperties((prev) => {
      const newProps = { ...prev };
      delete newProps[key];
      return newProps;
    });
  };

  const handleRestartApp = async () => {
    browserLogger.info(`🔄 Restarting app in ${evaluationMethod} mode...`, 'app-lifecycle');

    if (evaluationMethod !== 'client-side') {
      // Server modes - fetch flags from server first
      setIsEvaluatingFlags(true);

      try {
        const payload = {
          distinctId: serverDistinctId || 'anonymous',
          personProperties: serverProperties,
          evaluationMethod,
          onlyEvaluateLocally: onlyEvaluateLocally === "true",
          webSdkAdvancedConfig
        };

        browserLogger.info(`📡 Calling server for flags...`, 'flag-call');
        browserLogger.info(`Server request - distinctId: ${payload.distinctId}, properties: ${JSON.stringify(serverProperties)}`, 'flag-call');

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
        const flagCount = data.flags ? Object.keys(data.flags).length : 0;
        browserLogger.success(`✅ Received ${flagCount} flags from server`, 'flag-payload');

        if (data.flags) {
          browserLogger.info(`🚀 Bootstrapping flags: ${JSON.stringify(data.flags)}`, 'flag-payload');
          browserLogger.info(`Bootstrap data - distinctId: ${payload.distinctId}`, 'flag-payload');
          if (Object.keys(serverProperties).length > 0) {
            browserLogger.info(`Bootstrap data - properties: ${JSON.stringify(serverProperties)}`, 'flag-payload');
          }
        }

        // Restart app with server flags
        if (onAppRestart) {
          onAppRestart({
            evaluationMethod,
            webSdkAdvancedConfig,
            distinctId: payload.distinctId,
            personProperties: serverProperties,
            serverFlags: data.flags || {},
            selectedFlag,
          });
        }
      } catch (error) {
        browserLogger.error(`❌ Error evaluating flags: ${String(error)}`, 'flag-evaluation');
        console.error("Error evaluating flags:", error);
      } finally {
        setIsEvaluatingFlags(false);
      }
    } else {
      // Client mode - just restart with config
      if (onAppRestart) {
        onAppRestart({
          evaluationMethod,
          webSdkAdvancedConfig,
          distinctId: '',
          personProperties: {},
          serverFlags: {},
          selectedFlag,
        });
      }
    }
  };

  const isAdvancedConfigDisabled = webSdkAdvancedConfig === 'disable-flags' && evaluationMethod === 'client-side';

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Flag Evaluation Settings</CardTitle>
        <CardDescription>
          {evaluationMethod === "client-side"
            ? "Flags evaluated directly by PostHog client SDK in browser"
            : evaluationMethod === "server-side"
            ? "Server calls PostHog API → Returns flags to client for bootstrap"
            : "Server evaluates flags locally → Returns flags to client for bootstrap"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Feature Flag Selection */}
        <div className="space-y-2">
          <Label htmlFor="feature-flag">Feature Flag:</Label>
          <Select value={selectedFlag} onValueChange={(value) => {
            onFlagChange(value);
            browserLogger.info(`Selected feature flag: ${value}`, 'flag-switch');
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

        {/* Evaluation Method */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="evaluation-method">Flag evaluation method:</Label>
            <Select value={evaluationMethod} onValueChange={(value) => {
              setEvaluationMethod(value);
              onEvaluationMethodChange?.(value);
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

        {/* Server Mode Inputs */}
        {evaluationMethod !== "client-side" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="server-distinct-id">Server Distinct ID:</Label>
              <Input
                id="server-distinct-id"
                type="text"
                placeholder="Enter distinct ID to pass from server (or leave empty for anonymous)"
                value={serverDistinctId}
                onChange={(e) => setServerDistinctId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                This simulates the distinct_id your server would use when evaluating + bootstrapping flags
              </p>
            </div>

            <div className="space-y-2">
              <Label>Server Person Properties:</Label>
              {Object.keys(serverProperties).length > 0 && (
                <div className="space-y-2 p-3 bg-muted/50 rounded-md">
                  {Object.entries(serverProperties).map(([key, value]) => (
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
              <p className="text-xs text-muted-foreground">
                These properties simulate what your server would use for flag evaluation
              </p>
            </div>

          </>
        )}

        {/* Web SDK Advanced Flag Config */}
        <div className="space-y-2">
          <Label htmlFor="web-sdk-config">Web SDK Advanced Flag Config:</Label>
          <Select value={webSdkAdvancedConfig} onValueChange={setWebSdkAdvancedConfig}>
            <SelectTrigger id="web-sdk-config" className="w-full">
              <SelectValue placeholder="Select PostHog config" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default (flags load automatically)</SelectItem>
              <SelectItem value="disable-on-first-load">advanced_disable_feature_flags_on_first_load: true</SelectItem>
              <SelectItem value="disable-flags">advanced_disable_flags: true (no flag calls)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {webSdkAdvancedConfig === 'default'
              ? 'PostHog loads flags automatically on initialization and allows client calls.'
              : webSdkAdvancedConfig === 'disable-on-first-load'
              ? 'Flags only load after identify() is called. Client can still call for flags.'
              : 'PostHog cannot make any flag calls. Only uses bootstrap flags (server modes) or defaults (client mode).'}
          </p>
          {isAdvancedConfigDisabled && (
            <p className="text-xs text-amber-600">
              ⚠️ Demo disabled: No server bootstrap with advanced_disable_flags=true
            </p>
          )}
        </div>

        {/* Restart Button */}
        <div className="pt-4">
          <Button
            onClick={handleRestartApp}
            className="w-full"
            variant="default"
            disabled={isEvaluatingFlags}
          >
            <RotateCw className="mr-2 h-4 w-4" />
            {isEvaluatingFlags ? 'Fetching flags...' : `Restart App in ${evaluationMethod} mode`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}