import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle: string;
  children?: React.ReactNode; // Buttons/controls rendered on the right
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="page-header sticky top-0 z-40 bg-cream border-b border-border">
      <div className="max-w-162 mx-auto px-6 flex items-start justify-between gap-4 h-[72px]">
        <div className="flex-1 min-w-0 py-6">
          <h1 className="text-lg leading-6 h-6 font-semibold text-ink m-0 p-0">
            {title}
          </h1>
          <p className="text-xs leading-6 h-6 text-ink-light opacity-60 m-0 p-0">
            {subtitle}
          </p>
        </div>
        {children && (
          <div className="flex-shrink-0 flex items-center gap-2 h-[72px] py-6">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
