'use client';

import { Suspense } from 'react';
import ActivityPageInner from './ActivityPageInner';

export default function ActivityPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>
      }
    >
      <ActivityPageInner />
    </Suspense>
  );
}
