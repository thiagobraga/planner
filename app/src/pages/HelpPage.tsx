import { useEffect, useState } from 'react';

export function HelpPage() {
  const [activeSection, setActiveSection] = useState('welcome');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((e) => e.isIntersecting);
        if (visibleEntries.length > 0) {
          visibleEntries.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          setActiveSection(visibleEntries[0].target.id);
        }
      },
      {
        rootMargin: '-100px 0px -80% 0px',
      }
    );

    document.querySelectorAll('section[id]').forEach((section) => {
      observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      window.history.pushState(null, '', `#${id}`);
      setActiveSection(id);
    }
  };

  return (
    <div className="flex w-full min-h-full items-start">
      {/* Main Content */}
      <div className="flex-1 max-w-162 pb-32">
        <header className="sticky-page-header">
          <h1 className="text-[18px] leading-6 font-semibold text-ink m-0">
            Help
          </h1>
          <p className="text-[13px] leading-6 text-ink-light opacity-60 m-0">
            Learn how to use Planner
          </p>
        </header>
        <div className="h-12" />

        <section id="welcome" className="mb-12">
          <div className="text-[11px] font-medium tracking-widest text-ink-light uppercase mb-6 flex items-center">
            Welcome
            <div className="flex-1 h-px bg-border ml-4"></div>
          </div>
          <p className="mb-4">
            Planner is a Bullet Journal-inspired task manager designed to help you organize your day with focus and clarity. It supports daily planning, habit tracking, collections, and works offline.
          </p>
        </section>

        <section id="getting-started" className="mb-12">
          <div className="text-[11px] font-medium tracking-widest text-ink-light uppercase mb-6 flex items-center">
            Getting Started
            <div className="flex-1 h-px bg-border ml-4"></div>
          </div>
          <ul className="list-none">
            <li className="pl-6 relative before:content-['•'] before:absolute before:left-0 before:text-ink">
              <strong>Creating tasks:</strong> Type in the task input at the bottom of any page and press <kbd>Enter</kbd>. Use the QuickAdd shortcut (<kbd>Q</kbd>) for natural language dates — try 'tomorrow' or 'next Monday'.
            </li>
            <li className="pl-6 relative before:content-['•'] before:absolute before:left-0 before:text-ink">
              <strong>Completing tasks:</strong> Click the bullet to mark a task done. It becomes × with a line-through.
            </li>
            <li className="pl-6 relative before:content-['•'] before:absolute before:left-0 before:text-ink">
              <strong>Editing:</strong> Click any task to edit inline. Press <kbd>Enter</kbd> to save, <kbd>Esc</kbd> to cancel.
            </li>
            <li className="pl-6 relative before:content-['•'] before:absolute before:left-0 before:text-ink">
              <strong>Task types:</strong> Tasks show a • bullet. Notes show a – dash — press <kbd>-</kbd> in an empty input to create one.
            </li>
          </ul>
        </section>

        <section id="views" className="mb-12">
          <div className="text-[11px] font-medium tracking-widest text-ink-light uppercase mb-6 flex items-center">
            Views
            <div className="flex-1 h-px bg-border ml-4"></div>
          </div>
          <ul className="list-none space-y-4">
            <li className="pl-6 relative before:content-['•'] before:absolute before:left-0 before:text-ink">
              <strong>Daily</strong> — Your daily page. Shows today's tasks plus any overdue items, grouped by date.
            </li>
            <li className="pl-6 relative before:content-['•'] before:absolute before:left-0 before:text-ink">
              <strong>Inbox</strong> — The default capture spot for tasks not yet assigned to a collection.
            </li>
            <li className="pl-6 relative before:content-['•'] before:absolute before:left-0 before:text-ink">
              <strong>Monthly</strong> — A ledger-style month view. Each day is a row showing its date and notes.
            </li>
            <li className="pl-6 relative before:content-['•'] before:absolute before:left-0 before:text-ink">
              <strong>Upcoming</strong> — A 7-day lookahead of what's scheduled next.
            </li>
          </ul>
        </section>

        <section id="habits" className="mb-12">
          <div className="text-[11px] font-medium tracking-widest text-ink-light uppercase mb-6 flex items-center">
            Habits
            <div className="flex-1 h-px bg-border ml-4"></div>
          </div>
          <ul className="list-none space-y-4">
            <li className="pl-6 relative before:content-['•'] before:absolute before:left-0 before:text-ink">
              Track daily habits in <strong>Timeline</strong> view (rows of dots across the month) or <strong>Calendar</strong> view (dot-grid cards).
            </li>
            <li className="pl-6 relative before:content-['•'] before:absolute before:left-0 before:text-ink">
              Click a dot to log completion. Consecutive days form an <strong>unbroken chain</strong> — connected by a visible line.
            </li>
            <li className="pl-6 relative before:content-['•'] before:absolute before:left-0 before:text-ink">
              Organize habits into <strong>groups</strong> and nest <strong>sub-habits</strong> under parent habits.
            </li>
          </ul>
        </section>

        <section id="collections" className="mb-12">
          <div className="text-[11px] font-medium tracking-widest text-ink-light uppercase mb-6 flex items-center">
            Collections & Tags
            <div className="flex-1 h-px bg-border ml-4"></div>
          </div>
          <ul className="list-none space-y-4">
            <li className="pl-6 relative before:content-['•'] before:absolute before:left-0 before:text-ink">
              Create collections (projects) to group related tasks. Collections can be nested up to 4 levels deep.
            </li>
            <li className="pl-6 relative before:content-['•'] before:absolute before:left-0 before:text-ink">
              Drag tasks onto collections in the sidebar to file them.
            </li>
            <li className="pl-6 relative before:content-['•'] before:absolute before:left-0 before:text-ink">
              Add tags as <code className="text-[13px] bg-[rgba(245,240,232,0.5)] px-1 rounded">@label</code> chips to classify tasks.
            </li>
          </ul>
        </section>

        <section id="shortcuts" className="mb-12">
          <div className="text-[11px] font-medium tracking-widest text-ink-light uppercase mb-6 flex items-center">
            Keyboard Shortcuts
            <div className="flex-1 h-px bg-border ml-4"></div>
          </div>
          <table className="w-full text-left border-collapse">
            <tbody>
              <tr className="border-b border-border/50">
                <td className="py-2 w-32"><kbd>Q</kbd></td>
                <td className="py-2">Quick add task</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 w-32"><kbd>/</kbd></td>
                <td className="py-2">Search</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 w-32"><kbd>?</kbd></td>
                <td className="py-2">Toggle help dialog</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 w-32"><kbd>G</kbd> then <kbd>I</kbd></td>
                <td className="py-2">Go to Inbox</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 w-32"><kbd>G</kbd> then <kbd>T</kbd></td>
                <td className="py-2">Go to Daily</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 w-32"><kbd>G</kbd> then <kbd>U</kbd></td>
                <td className="py-2">Go to Upcoming</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 w-32"><kbd>↑</kbd> <kbd>↓</kbd></td>
                <td className="py-2">Navigate tasks</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 w-32"><kbd>Enter</kbd></td>
                <td className="py-2">Edit selected task</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 w-32"><kbd>Space</kbd></td>
                <td className="py-2">Toggle completion</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 w-32"><kbd>Tab</kbd></td>
                <td className="py-2">Indent task</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 w-32"><kbd>Esc</kbd></td>
                <td className="py-2">Close dialog</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section id="settings" className="mb-12">
          <div className="text-[11px] font-medium tracking-widest text-ink-light uppercase mb-6 flex items-center">
            Settings
            <div className="flex-1 h-px bg-border ml-4"></div>
          </div>
          <ul className="list-none space-y-4">
            <li className="pl-6 relative before:content-['•'] before:absolute before:left-0 before:text-ink">
              Choose your font: <strong>Lora</strong> (serif), <strong>Playpen Sans</strong> (handwriting), or <strong>Hubballi</strong> (script).
            </li>
            <li className="pl-6 relative before:content-['•'] before:absolute before:left-0 before:text-ink">
              Toggle the dot-grid background, switch between beige and white themes, or enable small caps.
            </li>
          </ul>
        </section>
      </div>

      {/* Right Sidebar (Table of Contents) */}
      <aside className="hidden lg:block w-[200px] shrink-0 sticky top-12 self-start ml-8">
        <div className="text-[11px] font-medium tracking-widest text-ink-light uppercase mb-4">
          On This Page
        </div>
        <nav className="flex flex-col border-l border-border">
          {[
            { id: 'welcome', label: 'Welcome' },
            { id: 'getting-started', label: 'Getting Started' },
            { id: 'views', label: 'Views' },
            { id: 'habits', label: 'Habits' },
            { id: 'collections', label: 'Collections & Tags' },
            { id: 'shortcuts', label: 'Keyboard Shortcuts' },
            { id: 'settings', label: 'Settings' },
          ].map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={(e) => scrollToSection(e, item.id)}
              className={`text-[13px] py-1.5 pl-4 -ml-[1px] border-l-2 transition-colors ${
                activeSection === item.id
                  ? 'text-ink border-ink font-medium'
                  : 'text-ink-light border-transparent hover:text-ink'
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
    </div>
  );
}
