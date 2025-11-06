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

export function FlagEvaluationForm() {
  const [evaluationMethod, setEvaluationMethod] = useState<string>("client-side");
  const [onlyEvaluateLocally, setOnlyEvaluateLocally] = useState<string>("false");

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Flag Evaluation Settings</CardTitle>
        <CardDescription>Configure how feature flags are evaluated</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
      </CardContent>
    </Card>
  );
}
