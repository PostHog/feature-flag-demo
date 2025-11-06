'use server';

import { logEmitter } from '@/lib/log-emitter';

export async function simulateTask(taskName: string) {
  logEmitter.info(`Starting task: ${taskName}`);

  // Simulate some processing steps
  await new Promise(resolve => setTimeout(resolve, 500));
  logEmitter.debug(`Processing ${taskName}...`);

  await new Promise(resolve => setTimeout(resolve, 800));
  logEmitter.info(`Validating ${taskName} data...`);

  // Simulate random outcome
  const success = Math.random() > 0.3;

  if (success) {
    await new Promise(resolve => setTimeout(resolve, 600));
    logEmitter.success(`✨ Task "${taskName}" completed successfully`);
    return { success: true, message: 'Task completed!' };
  } else {
    logEmitter.error(`Failed to complete task: ${taskName}`);
    return { success: false, message: 'Task failed!' };
  }
}

export async function simulateWarning() {
  logEmitter.warn('High memory usage detected (85%)');
  await new Promise(resolve => setTimeout(resolve, 300));
  logEmitter.info('Running garbage collection...');
  await new Promise(resolve => setTimeout(resolve, 500));
  logEmitter.success('Memory usage normalized');
}

export async function simulateBatchProcess() {
  logEmitter.info('Starting batch process...');

  for (let i = 1; i <= 5; i++) {
    await new Promise(resolve => setTimeout(resolve, 400));
    logEmitter.debug(`Processing item ${i}/5`);
  }

  logEmitter.success('Batch process completed');
}

export async function simulateError() {
  logEmitter.info('Attempting database connection...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  logEmitter.error('Database connection failed: Connection timeout');
  logEmitter.warn('Retrying in 5 seconds...');
}
