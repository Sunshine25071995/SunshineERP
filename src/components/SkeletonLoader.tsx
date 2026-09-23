import React from 'react';

export type SkeletonVariant = 'card' | 'list' | 'metric';

export const SkeletonLoader = ({ variant = 'card' }: { variant?: SkeletonVariant }) => {
  if (variant === 'metric') {
    return (
      <div className="w-full grid grid-cols-2 gap-4 shrink-0 p-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="animate-pulse bg-slate-200 rounded-[28px] p-5 flex flex-col justify-between shadow-sm min-h-[140px]">
            <div className="h-4 bg-slate-300 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-slate-300 rounded w-3/4 mt-auto"></div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className="w-full flex flex-col p-4 space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="animate-pulse bg-slate-200 rounded-[28px] p-4 flex items-center h-20 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-slate-300 shrink-0 mr-4"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-300 rounded w-3/4"></div>
              <div className="h-3 bg-slate-300 rounded w-1/2"></div>
            </div>
            <div className="w-16 h-6 bg-slate-300 rounded ml-4"></div>
          </div>
        ))}
      </div>
    );
  }

  // default card
  return (
    <div className="w-full p-4">
      <div className="animate-pulse bg-slate-200 rounded-[28px] w-full h-40 shadow-sm"></div>
    </div>
  );
};
