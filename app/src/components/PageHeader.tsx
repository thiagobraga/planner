import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: string;
  /** A `<Toolbar>` element - PageHeader renders it as-is; Toolbar owns its own layout classes. */
  toolbar?: ReactNode;
  /** Extra content in `.page-header-copy-text`, after the title/subtitle (e.g. CollectionsPage's inline sub-collection input). */
  afterTitle?: ReactNode;
  /** Extra classes on the `<h1>` (e.g. CollectionsPage's breadcrumb-trail layout). */
  titleClassName?: string;
  /** Extra classes on the outer `<header>`. */
  className?: string;
}

// De-dups the header markup every page (Daily/Monthly/Habits/Inbox/Collections)
// repeated verbatim. Wraps the current, already-settled CSS classes as-is -
// no positioning/CSS changes - see .specs/2026-08-14-page-header-button-group.
export function PageHeader({ title, subtitle, toolbar, afterTitle, titleClassName = '', className = '' }: PageHeaderProps) {
  return (
    <header className={`page-header-copy sticky-page-header max-w-162 ${className}`}>
      <div className="page-header-copy-text">
        <h1 className={`m-0 h-6 p-0 text-[18px] leading-6 font-semibold text-ink ${titleClassName}`}>{title}</h1>
        {subtitle && (
          <p className="page-header-subtitle m-0 h-6 p-0 text-[13px] leading-6 text-ink-light opacity-60">
            {subtitle}
          </p>
        )}
        {afterTitle}
      </div>

      {toolbar}
    </header>
  );
}
