import { NextRequest, NextResponse } from "next/server";
import { PostHog } from "posthog-node";
import { logEmitter } from "@/lib/log-emitter";

const posthogClient = new PostHog(
  process.env.POSTHOG_FEATURE_FLAG_API_KEY!,
  {
    host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0
  }
);

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
        const flags = await posthogClient.getAllFlags(
          distinctId,
          {
            personProperties,
            onlyEvaluateLocally
          }
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
      } catch (error) {
        const elapsedTime = Math.round(performance.now() - startTime);
        logEmitter.error(`Error evaluating flags after ${elapsedTime}ms: ${String(error)}`);
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

      logEmitter.info(`Client-side evaluation - no server evaluation performed for ${distinctId} (${elapsedTime}ms)`);
    }

    await posthogClient.shutdown();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in flag evaluation:", error);
    return NextResponse.json(
      { error: "Failed to evaluate flags", details: String(error) },
      { status: 500 }
    );
  }
}