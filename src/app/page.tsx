"use client";

import { useState } from "react";
import { PaneOne } from "@/components/pane-one";
import { PaneThree } from "@/components/pane-three";
import { FeatureFlagDemo } from "@/components/feature-flag-demo";

export default function Home() {
  const [selectedFlag, setSelectedFlag] = useState<string>("new-ui-flow");

  return (
    <div className="h-screen w-full p-16">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full items-start">
        <div className="h-full">
          <PaneOne selectedFlag={selectedFlag} onFlagChange={setSelectedFlag} />
        </div>
        <div className="h-full flex flex-col gap-6">
          <FeatureFlagDemo selectedFlag={selectedFlag} />
          <PaneThree />
        </div>
      </div>
    </div>
  );
}
