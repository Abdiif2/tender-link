import React from 'react';

export function SkeletonRow() {
  return (
    <div
      className="py-5 border-b border-[#E2E8F0] space-y-3 animate-pulse"
      aria-hidden="true"
    >
      <div className="flex items-center gap-2">
        <div className="h-3 w-24 rounded bg-[#E2E8F0]" />
        <div className="h-3 w-36 rounded bg-[#E2E8F0]" />
        <div className="h-3 w-20 rounded bg-[#E2E8F0]" />
      </div>
      <div className="h-5 w-4/5 rounded bg-[#E2E8F0]" />
      <div className="h-4 w-3/5 rounded bg-[#F1F5F9]" />
      <div className="flex items-center gap-3 pt-1">
        <div className="h-3.5 w-28 rounded bg-[#F1F5F9]" />
        <div className="h-3.5 w-32 rounded bg-[#F1F5F9]" />
        <div className="h-3.5 w-24 rounded bg-[#F1F5F9]" />
      </div>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div
      className="rounded-xl border border-[#E2E8F0] bg-white p-6 space-y-4 animate-pulse"
      aria-hidden="true"
    >
      <div className="h-4 w-24 rounded bg-[#E2E8F0]" />
      <div className="h-7 w-32 rounded bg-[#E2E8F0]" />
      <div className="h-4 w-full rounded bg-[#F1F5F9]" />
      <div className="space-y-2.5 pt-2">
        <div className="h-3.5 w-3/4 rounded bg-[#F1F5F9]" />
        <div className="h-3.5 w-2/3 rounded bg-[#F1F5F9]" />
        <div className="h-3.5 w-4/5 rounded bg-[#F1F5F9]" />
      </div>
      <div className="h-11 w-full rounded-lg bg-[#E2E8F0] mt-4" />
    </div>
  );
}
