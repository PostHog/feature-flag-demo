'use server';

import { LogMessage } from '@/lib/log-emitter';

// Helper function to emit logs via API endpoint
async function emitLog(level: LogMessage['level'], message: string) {
  try {
    await fetch('http://localhost:3000/api/emit-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, message }),
    });
  } catch (error) {
    console.error('Failed to emit log:', error);
  }
}

export async function simulateTask(taskName: string) {
  await emitLog('info', `Starting task: ${taskName}`);

  // Simulate some processing steps
  await new Promise(resolve => setTimeout(resolve, 500));
  await emitLog('debug', `Processing ${taskName}...`);

  await new Promise(resolve => setTimeout(resolve, 800));
  await emitLog('info', `Validating ${taskName} data...`);

  // Simulate random outcome
  const success = Math.random() > 0.3;

  if (success) {
    await new Promise(resolve => setTimeout(resolve, 600));
    await emitLog('success', `✨ Task "${taskName}" completed successfully`);
    return { success: true, message: 'Task completed!' };
  } else {
    await emitLog('error', `Failed to complete task: ${taskName}`);
    return { success: false, message: 'Task failed!' };
  }
}

export async function simulateWarning() {
  await emitLog('warn', 'High memory usage detected (85%)');
  await new Promise(resolve => setTimeout(resolve, 300));
  await emitLog('info', 'Running garbage collection...');
  await new Promise(resolve => setTimeout(resolve, 500));
  await emitLog('success', 'Memory usage normalized');
}

export async function simulateBatchProcess() {
  await emitLog('info', 'Starting batch process...');

  for (let i = 1; i <= 5; i++) {
    await new Promise(resolve => setTimeout(resolve, 400));
    await emitLog('debug', `Processing item ${i}/5`);
  }

  await emitLog('success', 'Batch process completed');
}

export async function simulateError() {
  await emitLog('info', 'Attempting database connection...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  await emitLog('error', 'Database connection failed: Connection timeout');
  await emitLog('warn', 'Retrying in 5 seconds...');
}
