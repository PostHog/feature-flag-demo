"use client";

import { useState, useRef } from "react";
import { FlagEvaluationForm } from "@/components/flag-evaluation-form-v2";
import { PaneThree } from "@/components/pane-three";
import { Card } from "@/components/ui/card";

export default function Home() {
  const [selectedFlag, setSelectedFlag] = useState<string>("new-ui-flow");
  const [evaluationMethod, setEvaluationMethod] = useState<string>("client-side");

  const [appConfig, setAppConfig] = useState({
    evaluationMethod: "client-side",
    webSdkAdvancedConfig: "default",
    distinctId: "",
    personProperties: {} as Record<string, any>,
    serverFlags: {} as Record<string, any>,
    selectedFlag: "new-ui-flow"
  });
  const [iframeKey, setIframeKey] = useState(0);
  const clearServerLogsRef = useRef<(() => void) | null>(null);

  const handleAppRestart = async (config: typeof appConfig) => {
    // First, tell the current iframe to reset PostHog before we restart
    try {
      const iframe = document.querySelector('iframe[title="Browser Simulation"]') as HTMLIFrameElement;
      if (iframe && iframe.contentWindow) {
        // Send message to iframe to reset PostHog
        iframe.contentWindow.postMessage({ type: 'RESET_POSTHOG' }, '*');

        // Wait a moment for the reset to complete
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.warn('Could not reset PostHog in current iframe:', error);
    }

    // Update config and restart iframe by changing the key
    // This creates a fresh iframe instance with new PostHog initialization
    setAppConfig(config);
    setSelectedFlag(config.selectedFlag);
    setEvaluationMethod(config.evaluationMethod);
    setIframeKey(prev => prev + 1);
  };


  return (
    <div className="h-screen w-full p-8">
      <div className="flex flex-col gap-6 h-full">
        {/* Browser Simulation - spans full width at top */}
        <div className="h-[60%]">
          <Card className="h-full overflow-hidden shadow-xl">
            <iframe
              key={iframeKey}
              src={`/browser-demo?config=${encodeURIComponent(JSON.stringify(appConfig))}`}
              className="w-full h-full border-none"
              title="Browser Simulation"
            />
          </Card>
        </div>

        {/* Bottom section - form and server logs */}
        <div className="h-[40%] grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Flag Evaluation Form */}
          <div className="overflow-auto">
            <FlagEvaluationForm
              selectedFlag={selectedFlag}
              onFlagChange={setSelectedFlag}
              onEvaluationMethodChange={setEvaluationMethod}
              onAppRestart={handleAppRestart}
            />
          </div>

          {/* Right: Server Logs */}
          <div className="overflow-hidden">
            <PaneThree onClearRef={(clearFn) => { clearServerLogsRef.current = clearFn; }} />
          </div>
        </div>
      </div>
    </div>
  );
}