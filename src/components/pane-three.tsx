'use client';

import { LogTerminal } from './log-terminal';

interface PaneThreeProps {
  onClearRef?: (clearFn: () => void) => void;
}

export function PaneThree({ onClearRef }: PaneThreeProps) {
  return (
    <div className="h-full">
      <LogTerminal maxLogs={200} autoScroll={true} onClearRef={onClearRef} />
    </div>
  );
}
