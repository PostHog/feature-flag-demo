import posthog from 'posthog-js';
import { browserLogger } from '@/lib/browser-logger';

export type FrontendEvaluationMode = 'client-side-flags' | 'server-side-flags';

interface FlagStore {
  [key: string]: string | boolean | number;
}

class FrontendPostHogManager {
  private static instance: FrontendPostHogManager;
  private currentMode: FrontendEvaluationMode = 'client-side-flags';
  private serverFlags: FlagStore = {};

  private constructor() {}

  static getInstance(): FrontendPostHogManager {
    if (!FrontendPostHogManager.instance) {
      FrontendPostHogManager.instance = new FrontendPostHogManager();
    }
    return FrontendPostHogManager.instance;
  }

  setMode(mode: FrontendEvaluationMode): void {
    this.currentMode = mode;
  }

  updateServerFlags(flags: FlagStore): void {
    this.serverFlags = { ...flags };
  }

  getStoredFlags(): FlagStore {
    return { ...this.serverFlags };
  }

  getCurrentMode(): FrontendEvaluationMode {
    return this.currentMode;
  }

  getFeatureFlag(flagKey: string): string | boolean | undefined {
    if (this.currentMode === 'server-side-flags') {
      const value = this.serverFlags[flagKey];
      // Convert number to string to match PostHog's return type
      if (typeof value === 'number') {
        return String(value);
      }
      return value as string | boolean | undefined;
    } else {
      return posthog.getFeatureFlag(flagKey);
    }
  }

  async identify(distinctId: string, properties?: Record<string, any>): Promise<void> {
    // Always call PostHog identify for analytics
    posthog.identify(distinctId, properties);

    // In client-side mode, PostHog will automatically reload flags
    if (this.currentMode === 'client-side-flags') {
      return; // PostHog handles flag reload automatically based on its configuration
    }

    // In server-side modes, we need to re-fetch flags from the server
    // since identify() should trigger flag re-evaluation with the new user context
    try {
      const response = await fetch('/api/evaluate-flags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          distinctId,
          personProperties: properties || {},
          evaluationMethod: 'server-side', // Use same method as current mode
          onlyEvaluateLocally: false, // Use default server evaluation
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.flags) {
          // Update our stored server flags with new evaluation
          this.updateServerFlags(data.flags);
          browserLogger.success(`🔄 Flags reloaded after identify: ${JSON.stringify(data.flags)}`, 'flag-evaluation');
        }
      } else {
        browserLogger.warn(`Failed to reload flags after identify: ${response.statusText}`, 'flag-evaluation');
      }
    } catch (error) {
      browserLogger.warn(`Error reloading flags after identify: ${error}`, 'flag-evaluation');
    }
  }

  capture(event: string, properties?: Record<string, any>): void {
    // Always allow event tracking regardless of flag mode
    posthog.capture(event, properties);
  }
}

export const frontendPostHogManager = FrontendPostHogManager.getInstance();