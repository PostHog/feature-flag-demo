import { PostHog } from 'posthog-node';
import { logEmitter } from '@/lib/log-emitter';

export type EvaluationMode = 'standard' | 'local-evaluation';

class PostHogManager {
  private static instance: PostHogManager;
  private standardClient: PostHog | null = null;
  private localEvalClient: PostHog | null = null;
  private currentMode: EvaluationMode = 'standard';
  private pollingInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): PostHogManager {
    if (!PostHogManager.instance) {
      PostHogManager.instance = new PostHogManager();
    }
    return PostHogManager.instance;
  }

  async initialize(mode: EvaluationMode = 'standard'): Promise<void> {
    logEmitter.info(`Initializing PostHog manager in ${mode} mode`);

    // Clean up existing clients
    await this.cleanup();

    this.currentMode = mode;

    if (mode === 'local-evaluation') {
      await this.initializeLocalEvaluation();
    } else {
      await this.initializeStandard();
    }
  }

  private async initializeStandard(): Promise<void> {
    logEmitter.info('Setting up PostHog client for standard evaluation (using public key)');

    const publicKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!publicKey) {
      logEmitter.error('NEXT_PUBLIC_POSTHOG_KEY is not defined');
      throw new Error('NEXT_PUBLIC_POSTHOG_KEY is required for standard evaluation');
    }

    // Use public key for standard evaluation
    this.standardClient = new PostHog(
      publicKey,
      {
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        flushAt: 1,
        flushInterval: 0,
      }
    );

    logEmitter.success('Standard PostHog client initialized with public key');
  }

  private async initializeLocalEvaluation(): Promise<void> {
    logEmitter.info('Setting up PostHog client for local evaluation mode (using feature flag API key)');

    const flagApiKey = process.env.POSTHOG_FEATURE_FLAG_API_KEY;
    if (!flagApiKey) {
      logEmitter.error('POSTHOG_FEATURE_FLAG_API_KEY is not defined');
      throw new Error('POSTHOG_FEATURE_FLAG_API_KEY is required for local evaluation');
    }

    // For local evaluation, use feature flag API key
    this.localEvalClient = new PostHog(
      flagApiKey,
      {
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        flushAt: 1,
        flushInterval: 0,
        // Enable feature flag polling for local evaluation
        featureFlagsPollingInterval: 30000, // Poll every 30 seconds
      }
    );

    // Initial fetch of feature flag definitions
    logEmitter.info('Fetching initial feature flag definitions for local evaluation');

    try {
      // The SDK will automatically start polling for flag definitions
      // We can trigger an initial fetch here
      await this.localEvalClient.reloadFeatureFlags();

      logEmitter.success('Local evaluation client initialized with flag definitions');

      // Set up periodic logging to show when flags are being refreshed
      this.pollingInterval = setInterval(() => {
        logEmitter.debug('Local evaluation: Polling for updated flag definitions');
      }, 30000);

    } catch (error) {
      logEmitter.error(`Failed to initialize local evaluation: ${String(error)}`);
      throw error;
    }
  }

  async switchMode(mode: EvaluationMode): Promise<void> {
    if (mode === this.currentMode && this.getActiveClient()) {
      logEmitter.info(`Already in ${mode} mode, no switch needed`);
      return;
    }

    logEmitter.info(`Switching from ${this.currentMode} to ${mode} mode`);
    await this.initialize(mode);
  }

  async evaluateFlags(
    distinctId: string,
    personProperties?: Record<string, any>,
    onlyEvaluateLocally?: boolean
  ): Promise<Record<string, any>> {
    // Ensure client is initialized
    if (!this.getActiveClient()) {
      await this.initialize(this.currentMode);
    }

    const client = this.getActiveClient();

    if (!client) {
      throw new Error(`No PostHog client available for ${this.currentMode} mode`);
    }

    const startTime = performance.now();

    try {
      const propertyCount = personProperties ? Object.keys(personProperties).length : 0;
      const propertyKeys = personProperties ? Object.keys(personProperties).join(', ') : 'none';

      if (this.currentMode === 'local-evaluation') {
        logEmitter.info(`Local evaluation: Evaluating flags for ${distinctId} with ${propertyCount} properties [${propertyKeys}]`);

        // Check if we might fall back to remote API
        if (onlyEvaluateLocally === false && propertyCount === 0) {
          logEmitter.warn(`Local evaluation with fallback enabled: Limited properties may trigger PostHog API fallback`);
        }

        const flags = await client.getAllFlags(distinctId, {
          personProperties,
          onlyEvaluateLocally: onlyEvaluateLocally ?? true,
        });

        const elapsed = Math.round(performance.now() - startTime);
        const flagCount = Object.keys(flags).length;
        logEmitter.success(`Local evaluation completed: ${flagCount} flags for ${distinctId} in ${elapsed}ms`);

        return flags;
      } else {
        logEmitter.info(`Standard evaluation: Calling PostHog API for ${distinctId} with ${propertyCount} properties [${propertyKeys}]`);

        const flags = await client.getAllFlags(distinctId, {
          personProperties,
          onlyEvaluateLocally: false,
        });

        const elapsed = Math.round(performance.now() - startTime);
        const flagCount = Object.keys(flags).length;
        logEmitter.success(`Standard API call completed: ${flagCount} flags for ${distinctId} in ${elapsed}ms`);

        return flags;
      }
    } catch (error) {
      const elapsed = Math.round(performance.now() - startTime);
      logEmitter.error(`Flag evaluation failed after ${elapsed}ms: ${String(error)}`);
      throw error;
    }
  }

  getActiveClient(): PostHog | null {
    return this.currentMode === 'local-evaluation' ? this.localEvalClient : this.standardClient;
  }

  getCurrentMode(): EvaluationMode {
    return this.currentMode;
  }

  async cleanup(): Promise<void> {
    logEmitter.info('Cleaning up PostHog clients');

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    if (this.standardClient) {
      await this.standardClient.shutdown();
      this.standardClient = null;
    }

    if (this.localEvalClient) {
      await this.localEvalClient.shutdown();
      this.localEvalClient = null;
    }
  }

  async capture(event: {
    distinctId: string;
    event: string;
    properties?: Record<string, any>;
  }): Promise<void> {
    const client = this.getActiveClient();
    if (client) {
      client.capture(event);
      await client.flush();
    }
  }
}

export const posthogManager = PostHogManager.getInstance();