import { NextRequest, NextResponse } from "next/server";
import { logEmitter } from "@/lib/log-emitter";
import { posthogManager } from "@/lib/posthog-manager";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      distinctId,
      personProperties,
      evaluationMethod,
      onlyEvaluateLocally
    } = body;

    logEmitter.info(`Evaluating flags for ${distinctId} (method: ${evaluationMethod}, localOnly: ${onlyEvaluateLocally})`);

    const startTime = performance.now();
    let result = {};

    if (evaluationMethod === "server-side" || evaluationMethod === "server-side-local") {
      try {
        // Switch PostHog manager mode based on evaluation method
        const mode = evaluationMethod === "server-side-local" ? "local-evaluation" : "standard";
        await posthogManager.switchMode(mode);

        const flags = await posthogManager.evaluateFlags(
          distinctId,
          personProperties,
          onlyEvaluateLocally
        );

        const elapsedTime = Math.round(performance.now() - startTime);

        result = {
          flags,
          evaluationMethod,
          distinctId,
          timestamp: new Date().toISOString(),
          elapsedTimeMs: elapsedTime
        };

        logEmitter.success(`Flags evaluated successfully for ${distinctId} in ${elapsedTime}ms`);

        // Track successful server-side flag evaluation
        await posthogManager.capture({
          distinctId,
          event: 'server_flag_evaluation_completed',
          properties: {
            evaluation_method: evaluationMethod,
            only_evaluate_locally: onlyEvaluateLocally,
            duration_ms: elapsedTime,
            flag_count: Object.keys(flags).length,
            property_count: Object.keys(personProperties || {}).length,
            success: true,
          }
        });
      } catch (error) {
        const elapsedTime = Math.round(performance.now() - startTime);
        logEmitter.error(`Error evaluating flags after ${elapsedTime}ms: ${String(error)}`);

        // Track failed server-side flag evaluation
        await posthogManager.capture({
          distinctId,
          event: 'server_flag_evaluation_error',
          properties: {
            evaluation_method: evaluationMethod,
            only_evaluate_locally: onlyEvaluateLocally,
            duration_ms: elapsedTime,
            error: String(error),
            property_count: Object.keys(personProperties || {}).length,
          }
        });

        throw error;
      }
    } else {
      const elapsedTime = Math.round(performance.now() - startTime);

      result = {
        message: "Client-side evaluation selected - flags evaluated on client",
        evaluationMethod,
        distinctId,
        timestamp: new Date().toISOString(),
        elapsedTimeMs: elapsedTime
      };

      // For client-side evaluation, don't log to server terminal since no server work is done
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in flag evaluation:", error);
    return NextResponse.json(
      { error: "Failed to evaluate flags", details: String(error) },
      { status: 500 }
    );
  }
}