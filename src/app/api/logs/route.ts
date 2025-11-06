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

      // Listen for log events
      const logHandler = (log: LogMessage) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(log)}\n\n`)
          );
        } catch (error) {
          console.error('Error sending log:', error);
        }
      };

      logEmitter.on('log', logHandler);

      // Cleanup on close
      const cleanup = () => {
        logEmitter.off('log', logHandler);
      };

      // Handle client disconnect
      return cleanup;
    },
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
