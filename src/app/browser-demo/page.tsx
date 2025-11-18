"use client";

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Circle } from "lucide-react";
import { FeatureFlagDemo } from "@/components/feature-flag-demo";
import { UserIdentity } from "@/components/user-identity";
import { browserLogger, BrowserLogMessage } from "@/lib/browser-logger";
import { frontendPostHogManager } from "@/lib/frontend-posthog-manager";
import posthog from "posthog-js";

function BrowserDemoContent() {
  const searchParams = useSearchParams();
  const [isPostHogInitialized, setIsPostHogInitialized] = useState(false);
  const [logs, setLogs] = useState<BrowserLogMessage[]>([]);

  // Parse config from URL params
  const config = (() => {
    try {
      const parsed = JSON.parse(searchParams.get('config') || '{}');
      // Ensure selectedFlag always has a default value
      return {
        evaluationMethod: "client-side",
        webSdkAdvancedConfig: "default",
        distinctId: "",
        personProperties: {},
        serverFlags: {},
        ...parsed,
        selectedFlag: parsed.selectedFlag || "new-ui-flow"
      };
    } catch {
      return {
        evaluationMethod: "client-side",
        webSdkAdvancedConfig: "default",
        distinctId: "",
        personProperties: {},
        serverFlags: {},
        selectedFlag: "new-ui-flow"
      };
    }
  })();

  // Subscribe to browser logger updates
  useEffect(() => {
    const unsubscribe = browserLogger.subscribe((log) => {
      setLogs(browserLogger.getLogs());
    });

    // Initialize with current logs
    setLogs(browserLogger.getLogs());

    return unsubscribe;
  }, []);

  // Listen for reset messages from parent
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'RESET_POSTHOG') {
        browserLogger.info('🧹 Received reset command from parent - resetting PostHog', 'app-lifecycle');
        try {
          posthog.reset();
          browserLogger.success('PostHog reset completed before app restart', 'app-lifecycle');
        } catch (error) {
          browserLogger.error(`Failed to reset PostHog: ${error}`, 'app-lifecycle');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Initialize PostHog with config from main app
  useEffect(() => {
    let flagsTimeoutId: NodeJS.Timeout | null = null;
    let isComponentMounted = true;

    const initializePostHog = async () => {
      // Clear browser logs
      browserLogger.clear();

      // Log iframe startup
      browserLogger.info("🚀 Browser simulation starting...", 'app-lifecycle');
      browserLogger.info(`Config: ${JSON.stringify(config)}`, 'app-lifecycle');

      // Simulate app initialization delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Reset PostHog right before initialization to ensure clean state
      try {
        browserLogger.info("🧹 Resetting PostHog to clean state", 'app-lifecycle');

        // Clear PostHog's localStorage data more aggressively
        if (typeof window !== 'undefined' && window.localStorage) {
          const keys = Object.keys(localStorage);
          const postHogKeys = keys.filter(key =>
            key.startsWith('ph_') ||
            key.includes('posthog') ||
            key.includes('PostHog') ||
            key.includes('phjs_')
          );
          postHogKeys.forEach(key => {
            localStorage.removeItem(key);
          });
        }

        // Clear cookies that might contain PostHog data
        if (typeof document !== 'undefined') {
          const cookies = document.cookie.split(';');
          const postHogCookies = cookies.filter(cookie => {
            const name = cookie.split('=')[0].trim();
            return name.startsWith('ph_') || name.includes('posthog');
          });
          postHogCookies.forEach(cookie => {
            const name = cookie.split('=')[0].trim();
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.localhost`;
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
          });
        }

        // Reset PostHog instance
        posthog.reset();
        browserLogger.success("PostHog state reset and storage cleared", 'app-lifecycle');
      } catch (error) {
        browserLogger.warn(`Failed to reset PostHog: ${error}`, 'app-lifecycle');
      }

      // Initialize PostHog based on provided config - be completely agnostic to evaluation method
      browserLogger.info("Setting up PostHog with provided configuration", 'app-lifecycle');

      // Build PostHog init config
      const initConfig: any = {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      };

      // Add server flags as bootstrap if provided
      if (config.serverFlags && Object.keys(config.serverFlags).length > 0) {
        initConfig.bootstrap = {
          featureFlags: config.serverFlags,
        };

        // Also bootstrap the distinct_id if provided
        if (config.distinctId && config.distinctId.trim()) {
          initConfig.bootstrap.distinctId = config.distinctId.trim();
          browserLogger.info(`📋 Bootstrap distinct_id: ${config.distinctId.trim()}`, 'app-lifecycle');
        }

        browserLogger.info(`📋 Bootstrap flags provided: ${JSON.stringify(config.serverFlags)}`, 'app-lifecycle');
      }

      // Add advanced config settings
      if (config.webSdkAdvancedConfig === 'disable-flags') {
        initConfig.advanced_disable_flags = true;
        browserLogger.info("📋 Setting advanced_disable_flags: true", 'app-lifecycle');
      } else if (config.webSdkAdvancedConfig === 'disable-on-first-load') {
        initConfig.advanced_disable_feature_flags_on_first_load = true;
        browserLogger.info("📋 Setting advanced_disable_feature_flags_on_first_load: true", 'app-lifecycle');
      }

      // Monitor PostHog network requests - SET UP BEFORE POSTHOG INIT!
      browserLogger.info('Setting up PostHog network monitoring...', 'general');

      // Intercept fetch
      const originalFetch = window.fetch;
      window.fetch = async function(...args) {
        const [url, options] = args;
        const urlStr = typeof url === 'string' ? url : url.toString();
        const method = options?.method || 'GET';
        browserLogger.debug(`📡 FETCH ${method} ${urlStr}`, 'general');
        return originalFetch.apply(this, args);
      };

      // Intercept XMLHttpRequest
      const originalXHROpen = XMLHttpRequest.prototype.open;
      const originalXHRSend = XMLHttpRequest.prototype.send;

      XMLHttpRequest.prototype.open = function(method: string, url: string | URL, async?: boolean, username?: string | null, password?: string | null) {
        (this as any)._method = method;
        (this as any)._url = url;
        browserLogger.debug(`📡 XHR ${method} ${url}`, 'general');
        return originalXHROpen.apply(this, [method, url, async ?? true, username, password]);
      };

      XMLHttpRequest.prototype.send = function(body) {
        return originalXHRSend.apply(this, [body]);
      };

      // Intercept sendBeacon
      const originalSendBeacon = navigator.sendBeacon;
      navigator.sendBeacon = function(url, data) {
        browserLogger.debug(`📡 BEACON ${url}`, 'general');
        return originalSendBeacon.apply(this, [url, data]);
      };

      browserLogger.success('✅ Network monitoring active (fetch, XHR, beacon)', 'general');

      browserLogger.info(`📋 Initializing PostHog: ${JSON.stringify(initConfig)}`, 'app-lifecycle');
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, initConfig);

      // If we have a distinct_id in the config, identify the user immediately after init
      if (config.distinctId && config.distinctId.trim()) {
        const distinctId = config.distinctId.trim();
        browserLogger.info(`🔄 Auto-identifying bootstrap user: ${distinctId}`, 'app-lifecycle');
        posthog.identify(distinctId, config.personProperties || {});
        browserLogger.success(`✅ Bootstrap user identified: ${distinctId}`, 'app-lifecycle');
      }

      browserLogger.success("PostHog initialized", 'app-lifecycle');

      // Log what PostHog will do based on its config
      if (config.webSdkAdvancedConfig === 'disable-flags') {
        browserLogger.warn("⚠️ advanced_disable_flags: true - No flag calls possible", 'flag-call');
      } else if (config.webSdkAdvancedConfig === 'disable-on-first-load') {
        browserLogger.info("advanced_disable_feature_flags_on_first_load: true", 'flag-call');
        browserLogger.info("Flags will only load after identify() is called", 'flag-call');
      } else {
        browserLogger.info("PostHog will load flags according to its default behavior", 'flag-call');
      }

      // Note: PostHog initialization is complete. User identification happens
      // only when explicitly triggered by user via the "Identify User" button.

      // Log successful initialization
      browserLogger.success("✅ Browser simulation initialized", 'app-lifecycle');

      // Helper function to complete initialization
      const completeInitialization = () => {
        if (!isComponentMounted) return;

        if (flagsTimeoutId) {
          clearTimeout(flagsTimeoutId);
          flagsTimeoutId = null;
        }

        browserLogger.info("PostHog ready for interactions", 'flag-evaluation');
        setIsPostHogInitialized(true);
      };

      // Determine if we need to wait for flags to load
      // Only wait if flags aren't disabled and there are no bootstrap flags
      const hasBootstrapFlags = config.serverFlags && Object.keys(config.serverFlags).length > 0;
      const shouldWaitForFlags = config.webSdkAdvancedConfig !== 'disable-flags' &&
        config.webSdkAdvancedConfig !== 'disable-on-first-load' &&
        !hasBootstrapFlags; // Don't wait if we have bootstrap flags

      if (shouldWaitForFlags) {
        // For client-side default mode, wait for flags to load
        browserLogger.info("Waiting for flags to load...", 'flag-evaluation');

        // Use onFeatureFlags callback to wait for flags
        posthog.onFeatureFlags(() => {
          if (!isComponentMounted) return;
          browserLogger.success("Flags loaded successfully", 'flag-evaluation');
          completeInitialization();
        });

        // Set a timeout in case flags never load
        flagsTimeoutId = setTimeout(() => {
          if (!isComponentMounted || isPostHogInitialized) return;
          browserLogger.warn("Flag load timeout - proceeding anyway", 'flag-evaluation');
          completeInitialization();
        }, 5000);
      } else {
        // No need to wait for flags in other modes (server-side or disabled flags)
        completeInitialization();
      }
    };

    initializePostHog();

    // Cleanup function
    return () => {
      isComponentMounted = false;
      if (flagsTimeoutId) {
        clearTimeout(flagsTimeoutId);
      }
    };
  }, []); // Run only once on mount

  return (
    <Card className="h-full overflow-hidden shadow-xl">
      {/* Browser Chrome */}
      <div className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border-b px-4 py-2">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 cursor-pointer" />
            <div className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 cursor-pointer" />
            <div className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 cursor-pointer" />
          </div>
          <div className="flex-1 bg-white dark:bg-slate-800 rounded px-3 py-1 text-xs text-muted-foreground font-mono">
            http://localhost:3000 - Demo App (Browser Simulation)
          </div>
        </div>
      </div>

      {/* Browser Content */}
      <div className="flex h-[calc(100%-44px)]">
        {/* User Identity - Left Side */}
        <div className="w-1/4 border-r">
          <UserIdentity
            webSdkAdvancedConfig={config.webSdkAdvancedConfig}
            selectedFlag={config.selectedFlag}
            bootstrapDistinctId={config.distinctId}
          />
        </div>

        {/* Main App Content - Center */}
        <div className="flex-1 overflow-auto">
          {!isPostHogInitialized ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground">Loading browser simulation...</p>
              </div>
            </div>
          ) : (
            <div className="h-full p-4">
              <FeatureFlagDemo
                selectedFlag={config.selectedFlag}
                fullHeight={true}
              />
            </div>
          )}
        </div>

        {/* Browser Console - Right Side */}
        <div className="w-1/3 border-l overflow-auto bg-slate-50 dark:bg-slate-950 p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">
                Browser Console
              </h3>
              <button
                onClick={() => {
                  browserLogger.clear();
                  setLogs([]);
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-background/50"
                title="Clear console logs"
              >
                Clear
              </button>
            </div>
            <div className="space-y-1 font-mono text-xs" data-testid="console-logs">
              {logs.map((log, index) => (
                <div
                  key={index}
                  className={`px-2 py-1 rounded log-entry ${
                    log.level === 'error' ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300' :
                    log.level === 'warn' ? 'bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300' :
                    log.level === 'success' ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300' :
                    log.level === 'debug' ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' :
                    'bg-slate-100 dark:bg-slate-900'
                  }`}
                >
                  <span className="opacity-50">[{new Date(log.timestamp).toLocaleTimeString()}]</span> {log.message}
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-muted-foreground italic">No console logs yet...</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function BrowserDemo() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading demo...</p>
        </div>
      </div>
    }>
      <BrowserDemoContent />
    </Suspense>
  );
}