import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
    const projectId = process.env.POSTHOG_PROJECT_ID;
    const host = process.env.POSTHOG_HOST || "https://us.i.posthog.com";

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing PostHog personal API key" },
        { status: 500 }
      );
    }

    if (!projectId) {
      return NextResponse.json(
        { error: "Missing PostHog project ID. Add POSTHOG_PROJECT_ID to your .env file" },
        { status: 500 }
      );
    }

    // Fetch feature flags for the specific project
    const response = await fetch(
      `${host}/api/projects/${projectId}/feature_flags/`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PostHog API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Extract just the flag keys and names
    const flags = data.results.map((flag: any) => ({
      key: flag.key,
      name: flag.name,
      active: flag.active,
    }));

    return NextResponse.json({ flags });
  } catch (error) {
    console.error("Error fetching feature flags:", error);
    return NextResponse.json(
      { error: "Failed to fetch feature flags", details: String(error) },
      { status: 500 }
    );
  }
}
