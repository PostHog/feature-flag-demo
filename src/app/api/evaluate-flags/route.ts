import { NextRequest, NextResponse } from "next/server";
import { PostHog } from "posthog-node";
import { getLogEmitter } from "@/lib/log-emitter";

const posthogClient = new PostHog(
  process.env.NEXT_PUBLIC_POSTHOG_KEY!,
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

    const logEmitter = getLogEmitter();

    logEmitter.emit("log", {
      task: "flag-evaluation",
      message: `Evaluating flags for ${distinctId}`,
      data: {
        method: evaluationMethod,
        localOnly: onlyEvaluateLocally,
        properties: personProperties
      }
    });

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

        result = {
          flags,
          evaluationMethod,
          distinctId,
          timestamp: new Date().toISOString()
        };

        logEmitter.emit("log", {
          task: "flag-evaluation",
          message: `Flags evaluated successfully`,
          data: result
        });
      } catch (error) {
        logEmitter.emit("log", {
          task: "flag-evaluation",
          message: `Error evaluating flags: ${error}`,
          data: { error: String(error) }
        });
        throw error;
      }
    } else {
      result = {
        message: "Client-side evaluation selected - flags evaluated on client",
        evaluationMethod,
        distinctId,
        timestamp: new Date().toISOString()
      };

      logEmitter.emit("log", {
        task: "flag-evaluation",
        message: `Client-side evaluation - no server evaluation performed`,
        data: result
      });
    }

    await posthogClient.shutdownAsync();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in flag evaluation:", error);
    return NextResponse.json(
      { error: "Failed to evaluate flags", details: String(error) },
      { status: 500 }
    );
  }
}