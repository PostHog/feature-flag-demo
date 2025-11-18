import { logEmitter, LogMessage } from '@/lib/log-emitter';

export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const initialMessage = {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: '🔌 Connected to log stream',
      };
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(initialMessage)}\n\n`)
      );

      // Track if this connection is closed
      let isClosed = false;

      // Listen for log events
      const logHandler = (log: LogMessage) => {
        // If we know the connection is closed, don't try to send anything
        if (isClosed) {
          return;
        }

        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(log)}\n\n`)
          );
        } catch (error) {
          // Mark as closed and remove the listener
          isClosed = true;
          logEmitter.off('log', logHandler);

          // Only log errors that aren't about closed controllers
          if (!(error instanceof Error && error.message?.includes('Controller is already closed'))) {
            console.error('Error sending log:', error);
          }
        }
      };

      logEmitter.on('log', logHandler);

      // Cleanup on close
      const cleanup = () => {
        isClosed = true;
        logEmitter.off('log', logHandler);
      };

      // Handle client disconnect
      return cleanup;
    },
    cancel(reason) {
      // This is called when the stream is cancelled (e.g., client disconnects)
      // The cleanup function returned by start() will be called automatically
      console.log('SSE stream cancelled:', reason);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
