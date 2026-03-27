import React from "react";

type Props = React.SelectHTMLAttributes<HTMLSelectElement>;

export default function Select({ className = "", children, ...props }: Props) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`w-full appearance-none text-sm border border-slate-200 rounded-lg px-3 py-2 pr-8 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50 ${className}`}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}
