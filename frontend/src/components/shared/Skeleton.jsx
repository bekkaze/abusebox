import React from 'react';

export function SkeletonLine({ className = '' }) {
  return <div className={`animate-pulse rounded bg-slate-200 dark:bg-slate-700 ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
      <SkeletonLine className="h-4 w-1/3" />
      <SkeletonLine className="h-8 w-1/2" />
      <SkeletonLine className="h-3 w-2/3" />
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 flex items-center shadow-sm">
      <div className="animate-pulse rounded-xl h-12 w-12 bg-slate-200 dark:bg-slate-700" />
      <div className="pl-4 space-y-2 flex-1">
        <SkeletonLine className="h-3 w-20" />
        <SkeletonLine className="h-7 w-12" />
      </div>
    </div>
  );
}

export function AssetCardSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        <div className="animate-pulse rounded-xl h-10 w-10 bg-slate-200 dark:bg-slate-700" />
        <div className="space-y-2 flex-1">
          <SkeletonLine className="h-4 w-2/3" />
          <SkeletonLine className="h-3 w-1/3" />
        </div>
      </div>
      <SkeletonLine className="h-4 w-1/2" />
      <div className="flex gap-1 pt-3 border-t border-slate-100 dark:border-slate-700">
        <SkeletonLine className="h-5 w-8" />
        <SkeletonLine className="h-5 w-10" />
        <SkeletonLine className="h-5 w-8" />
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <section className="space-y-5">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-3">
        <SkeletonLine className="h-8 w-1/3" />
        <SkeletonLine className="h-4 w-1/2" />
        <div className="flex gap-1.5">
          <SkeletonLine className="h-5 w-10" />
          <SkeletonLine className="h-5 w-12" />
          <SkeletonLine className="h-5 w-8" />
        </div>
      </div>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
            <SkeletonLine className="h-3 w-16" />
            <SkeletonLine className="h-6 w-10" />
          </div>
        ))}
      </div>
      <SkeletonCard />
    </section>
  );
}
