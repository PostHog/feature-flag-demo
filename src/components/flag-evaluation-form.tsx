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

interface FeatureFlag {
  key: string;
  name: string;
  active: boolean;
}

interface FlagEvaluationFormProps {
  selectedFlag: string;
  onFlagChange: (flag: string) => void;
}

export function FlagEvaluationForm({
  selectedFlag,
  onFlagChange,
}: FlagEvaluationFormProps) {
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [isLoadingFlags, setIsLoadingFlags] = useState<boolean>(true);
  const [evaluationMethod, setEvaluationMethod] = useState<string>("client-side");
  const [onlyEvaluateLocally, setOnlyEvaluateLocally] = useState<string>("false");
  const [email, setEmail] = useState<string>("");
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
  }, []);

  const handleAddProperty = () => {
    if (newPropertyKey.trim() && newPropertyValue.trim()) {
      setPersonProperties((prev) => ({
        ...prev,
        [newPropertyKey.trim()]: newPropertyValue.trim(),
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

  const handleIdentifyUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (email) {
      const properties = { ...personProperties, is_user: true };
      setPersonProperties(properties);
      posthog.identify(email, properties);
    }
  };

  const handleEvaluateFlags = async () => {
    const distinctId = posthog.get_distinct_id();

    const payload = {
      distinctId,
      personProperties,
      evaluationMethod,
      onlyEvaluateLocally: onlyEvaluateLocally === "true"
    };

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
      console.log("Flag evaluation result:", data);
    } catch (error) {
      console.error("Error evaluating flags:", error);
    }
  };

  const handleRefreshFlags = async () => {
    const startTime = performance.now();
    try {
      await posthog.reloadFeatureFlags();
      const elapsedTime = Math.round(performance.now() - startTime);
      console.log(`Feature flags refreshed successfully in ${elapsedTime}ms`);

      // Log to terminal via API
      await fetch('/api/emit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'success',
          message: `Client-side flags refreshed in ${elapsedTime}ms`
        }),
      });
    } catch (error) {
      const elapsedTime = Math.round(performance.now() - startTime);
      console.error(`Error refreshing feature flags after ${elapsedTime}ms:`, error);

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
      posthog.reset();
      const newDistinctId = posthog.get_distinct_id();

      console.log(`Distinct ID reset from ${oldDistinctId} to ${newDistinctId}`);

      // Log to terminal via API
      await fetch('/api/emit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'info',
          message: `Reset distinct ID: ${oldDistinctId} → ${newDistinctId}`
        }),
      });

      // Clear the email input
      setEmail('');
      setPersonProperties({});
    } catch (error) {
      console.error('Error resetting distinct ID:', error);

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
        <CardDescription>Configure how feature flags are evaluated</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="feature-flag">Feature Flag:</Label>
          <Select value={selectedFlag} onValueChange={onFlagChange}>
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

        <form onSubmit={handleIdentifyUser} className="space-y-2">
          <Label htmlFor="email">Email:</Label>
          <div className="flex gap-2">
            <Input
              id="email"
              type="email"
              placeholder="Enter email to identify user"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" variant="secondary">
              Identify
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleResetDistinctId}
              title="Reset distinct ID"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="evaluation-method">Flag evaluation method:</Label>
            <Select value={evaluationMethod} onValueChange={setEvaluationMethod}>
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
              disabled={evaluationMethod === "client-side"}
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
            onClick={handleEvaluateFlags}
            className="flex-1"
            variant="default"
          >
            Evaluate Flags
          </Button>
          <Button
            onClick={handleRefreshFlags}
            variant="outline"
            className="flex-1"
          >
            Refresh Flags
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
