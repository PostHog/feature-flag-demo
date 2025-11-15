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
  private isInitialized = false;

  private constructor() {}

  static getInstance(): FrontendPostHogManager {
    if (!FrontendPostHogManager.instance) {
      FrontendPostHogManager.instance = new FrontendPostHogManager();
    }
    return FrontendPostHogManager.instance;
  }

  async switchMode(mode: FrontendEvaluationMode): Promise<void> {
    if (mode === this.currentMode && this.isInitialized) {
      browserLogger.info(`Already in ${mode} mode, no switch needed`, 'flag-switch');
      return;
    }

    browserLogger.info(`Switching frontend PostHog mode: ${this.currentMode} → ${mode}`, 'flag-switch');
    this.currentMode = mode;

    if (mode === 'client-side-flags') {
      await this.initializeClientSideMode();
    } else {
      await this.initializeServerSideMode();
    }
  }

  private async initializeClientSideMode(): Promise<void> {
    browserLogger.info('Initializing PostHog for client-side flag evaluation', 'flag-switch');

    // Reset PostHog to default configuration
    if (this.isInitialized) {
      posthog.reset();
    }

    // Initialize with standard configuration (flags enabled)
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      // Default settings allow flag calls
    });

    this.isInitialized = true;
    browserLogger.success('PostHog initialized for client-side evaluation', 'flag-switch');
  }

  private async initializeServerSideMode(): Promise<void> {
    browserLogger.info('Initializing PostHog for server-side flag evaluation (flags disabled)', 'flag-switch');

    // Reset PostHog to clear any existing state
    if (this.isInitialized) {
      posthog.reset();
    }

    // Initialize with flags disabled and bootstrap with server flags
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      advanced_disable_flags: true, // Prevent client from calling for flags
      bootstrap: {
        featureFlags: this.serverFlags, // Use server-provided flags
      },
    });

    this.isInitialized = true;
    browserLogger.success('PostHog initialized for server-side evaluation (client flags disabled)', 'flag-switch');
  }

  updateServerFlags(flags: FlagStore, distinctId?: string, selectedFlag?: string): void {
    this.serverFlags = { ...flags };
    const flagCount = Object.keys(flags).length;

    browserLogger.info(`Storing ${flagCount} flags from server${distinctId ? ` for ${distinctId}` : ''}`, 'flag-payload');

    // If we're in server-side mode, override the flags in PostHog
    if (this.currentMode === 'server-side-flags') {
      try {
        browserLogger.info(`Attempting to override ${flagCount} flags in PostHog...`, 'flag-payload');

        // Override all flags first
        posthog.featureFlags.overrideFeatureFlags(flags);
        browserLogger.info(`Successfully called overrideFeatureFlags with all flags`, 'flag-payload');

        // If a specific flag is selected, highlight that override
        if (selectedFlag && selectedFlag in flags) {
          const flagValue = flags[selectedFlag];
          browserLogger.info(`Overriding selected flag: ${selectedFlag} = ${flagValue}`, 'flag-payload');

          // Call override for the specific selected flag to ensure it's applied
          const singleFlagOverride = { [selectedFlag]: flagValue };
          posthog.featureFlags.overrideFeatureFlags(singleFlagOverride);
          browserLogger.info(`Successfully called overrideFeatureFlags for ${selectedFlag}`, 'flag-payload');

          // Verify the override worked
          setTimeout(() => {
            const verifyValue = posthog.getFeatureFlag(selectedFlag);
            browserLogger.info(`Verification: PostHog now returns ${selectedFlag} = ${verifyValue}`, 'flag-payload');
          }, 100);
        }

        Object.entries(flags).forEach(([flagKey, flagValue]) => {
          browserLogger.debug(`Override flag: ${flagKey} = ${flagValue}`, 'flag-payload');
        });

        browserLogger.success(`Applied ${flagCount} server flags to PostHog client`, 'flag-payload');

        // Force PostHog to notify listeners about flag changes
        try {
          posthog.featureFlags._reloadFeatureFlags();
          browserLogger.info(`Triggered PostHog flag reload to notify listeners`, 'flag-payload');
        } catch (reloadError) {
          browserLogger.warn(`Could not trigger flag reload: ${String(reloadError)}`, 'flag-payload');
        }

      } catch (error) {
        browserLogger.error(`Failed to override flags in PostHog: ${String(error)}`, 'flag-payload');
        console.error('Flag override error details:', error);
      }
    }
  }

  getStoredFlags(): FlagStore {
    return { ...this.serverFlags };
  }

  getCurrentMode(): FrontendEvaluationMode {
    return this.currentMode;
  }

  // Wrapper methods that respect the current mode
  async reloadFlags(): Promise<void> {
    if (this.currentMode === 'client-side-flags') {
      browserLogger.info('Refreshing client-side flags via PostHog SDK', 'flag-call');
      await posthog.reloadFeatureFlags();
      browserLogger.success('Client-side flags refreshed', 'flag-call');
    } else {
      browserLogger.warn('Cannot refresh flags in server-side mode - use "Get Flags from Server"', 'flag-call');
    }
  }

  identify(distinctId: string, properties?: Record<string, any>): void {
    if (this.currentMode === 'client-side-flags') {
      browserLogger.info(`Identifying user in PostHog: ${distinctId}`, 'identification');
      posthog.identify(distinctId, properties);
      browserLogger.success('User identified in PostHog client', 'identification');
      browserLogger.info('Auto-refreshing flags after identification...', 'flag-call');
    } else {
      browserLogger.info(`User data updated: ${distinctId} (server-side mode - PostHog not called)`, 'identification');
    }
  }

  capture(event: string, properties?: Record<string, any>): void {
    // Always allow event tracking regardless of flag mode
    posthog.capture(event, properties);
  }

  getFeatureFlag(flagKey: string): string | boolean | undefined {
    if (this.currentMode === 'server-side-flags') {
      return this.serverFlags[flagKey];
    } else {
      return posthog.getFeatureFlag(flagKey);
    }
  }
}

export const frontendPostHogManager = FrontendPostHogManager.getInstance();