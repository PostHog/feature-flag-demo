"use client";

import { useState } from "react";
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
import posthog from "posthog-js";

export function FlagEvaluationForm() {
  const [evaluationMethod, setEvaluationMethod] = useState<string>("client-side");
  const [onlyEvaluateLocally, setOnlyEvaluateLocally] = useState<string>("false");
  const [email, setEmail] = useState<string>("");
  const [personProperties, setPersonProperties] = useState<Record<string, any>>({});

  const handleIdentifyUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      const properties = { is_user: true };
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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Flag Evaluation Settings</CardTitle>
        <CardDescription>Configure how feature flags are evaluated</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
          </div>
        </form>

        <div className="space-y-2">
          <Label htmlFor="evaluation-method">Flag evaluation method:</Label>
          <Select value={evaluationMethod} onValueChange={setEvaluationMethod}>
            <SelectTrigger id="evaluation-method">
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
          <Select value={onlyEvaluateLocally} onValueChange={setOnlyEvaluateLocally}>
            <SelectTrigger id="evaluate-locally">
              <SelectValue placeholder="Select option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">True</SelectItem>
              <SelectItem value="false">False</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleEvaluateFlags}
          className="w-full"
          variant="default"
        >
          Evaluate Flags
        </Button>
      </CardContent>
    </Card>
  );
}
