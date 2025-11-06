'use client';

import { LogTerminal } from './log-terminal';

export function PaneThree() {
  return (
    <div className="h-full">
      <LogTerminal maxLogs={200} autoScroll={true} />
    </div>
  );
}
