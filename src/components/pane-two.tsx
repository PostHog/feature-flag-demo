'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { simulateTask, simulateWarning, simulateBatchProcess, simulateError } from '@/app/actions';
import posthog from 'posthog-js';

export function PaneTwo() {
  const [taskName, setTaskName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSimulateTask = async () => {
    if (!taskName.trim()) return;

    // Track task simulation start
    posthog.capture('task_simulation_started', {
      task_name: taskName,
    });

    setIsProcessing(true);
    await simulateTask(taskName);
    setIsProcessing(false);
    setTaskName('');
  };

  const handleWarning = async () => {
    setIsProcessing(true);
    await simulateWarning();
    setIsProcessing(false);
  };

  const handleBatchProcess = async () => {
    // Track batch process trigger
    posthog.capture('batch_process_triggered');

    setIsProcessing(true);
    await simulateBatchProcess();
    setIsProcessing(false);
  };

  const handleError = async () => {
    // Track error simulation trigger
    posthog.capture('error_simulation_triggered');

    setIsProcessing(true);
    await simulateError();
    setIsProcessing(false);
  };

  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Log Control Panel</CardTitle>
          <CardDescription>
            Trigger server actions to generate logs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Custom Task</label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter task name..."
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isProcessing) {
                    handleSimulateTask();
                  }
                }}
                disabled={isProcessing}
              />
              <Button
                onClick={handleSimulateTask}
                disabled={!taskName.trim() || isProcessing}
              >
                Run
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t space-y-2">
            <p className="text-sm font-medium mb-3">Quick Actions</p>
            <Button
              onClick={handleBatchProcess}
              disabled={isProcessing}
              variant="outline"
              className="w-full"
            >
              Batch Process
            </Button>
            <Button
              onClick={handleWarning}
              disabled={isProcessing}
              variant="outline"
              className="w-full"
            >
              Memory Warning
            </Button>
            <Button
              onClick={handleError}
              disabled={isProcessing}
              variant="outline"
              className="w-full"
            >
              Simulate Error
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
