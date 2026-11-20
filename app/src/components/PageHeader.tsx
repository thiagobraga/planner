import type { PageHeaderProps } from '../types/widgets';

// De-dups the header markup every page (Daily/Monthly/Habits/Inbox/Collections)
// repeated verbatim. Wraps the current, already-settled CSS classes as-is -
// no positioning/CSS changes - see .specs/2026-08-14-page-header-button-group.
export function PageHeader({ title, toolbar, actions, afterTitle, titleClassName = '', titleAriaLabel, className = '' }: PageHeaderProps) {
  if (actions) {
    return (
      <header className={`page-header-copy sticky-page-header ${className}`}>
        <div className="page-header-row">
          <h1
            aria-label={titleAriaLabel}
            className={`page-header-title m-0 h-6 p-0 text-[18px] leading-6 font-semibold text-ink ${titleClassName}`}
          >
            {title}
          </h1>
          {actions}
        </div>
        {afterTitle}
      </header>
    );
  }

  return (
    <header className={`page-header-copy sticky-page-header ${className}`}>
      <div className="page-header-copy-text">
        <h1
          aria-label={titleAriaLabel}
          className={`m-0 h-6 p-0 text-[18px] leading-6 font-semibold text-ink ${titleClassName}`}
        >
          {title}
        </h1>
        {afterTitle}
      </div>

      {toolbar}
    </header>
  );
}
