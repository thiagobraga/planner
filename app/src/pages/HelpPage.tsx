import { useEffect, useState } from 'react';
import { helpContent } from '../i18n/helpContent';
import { useI18n } from '../i18n/I18nContext';

export function HelpPage() {
  const { locale } = useI18n();
  const content = helpContent[locale];
  const [activeSection, setActiveSection] = useState('welcome');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((entry) => entry.isIntersecting);
        if (visibleEntries.length > 0) {
          visibleEntries.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          setActiveSection(visibleEntries[0].target.id);
        }
      },
      { rootMargin: '-100px 0px -80% 0px' },
    );

    document.querySelectorAll('section[id]').forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      window.history.pushState(null, '', `#${id}`);
      setActiveSection(id);
    }
  };

  const toc = [
    ...content.sections.map(({ id, title }) => ({ id, title })),
    { id: 'shortcuts', title: content.shortcutsTitle },
  ];

  return (
    <div className="flex w-full min-h-full items-start">
      <div className="flex-1 max-w-162 pb-32">
        <header className="sticky-page-header">
          <h1 className="text-[18px] leading-6 font-semibold text-ink m-0">{content.title}</h1>
          <p className="text-[13px] leading-6 text-ink-light opacity-60 m-0">{content.subtitle}</p>
        </header>
        <div className="h-12" />

        {content.sections.map((section) => (
          <section key={section.id} id={section.id} className="mb-12">
            <div className="text-[11px] font-medium tracking-widest text-ink-light uppercase mb-6 flex items-center">
              {section.title}
              <div className="flex-1 h-px bg-border ml-4" />
            </div>
            {section.paragraphs?.map((paragraph) => <p key={paragraph} className="mb-4">{paragraph}</p>)}
            {section.items && (
              <ul className="list-none space-y-4">
                {section.items.map((item) => (
                  <li key={item} className="pl-6 relative before:content-['•'] before:absolute before:left-0 before:text-ink">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <section id="shortcuts" className="mb-12">
          <div className="text-[11px] font-medium tracking-widest text-ink-light uppercase mb-6 flex items-center">
            {content.shortcutsTitle}
            <div className="flex-1 h-px bg-border ml-4" />
          </div>
          <table className="w-full text-left border-collapse">
            <tbody>
              {content.shortcuts.map((shortcut) => (
                <tr key={shortcut.label} className="border-b border-border/50">
                  <td className="py-2 w-32">
                    {shortcut.keys.map((key, index) => (
                      <span key={key}>
                        {index > 0 && ` ${content.then} `}
                        <kbd>{key}</kbd>
                      </span>
                    ))}
                  </td>
                  <td className="py-2">{shortcut.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <aside className="hidden lg:block w-[200px] shrink-0 sticky top-12 self-start ml-8">
        <div className="text-[11px] font-medium tracking-widest text-ink-light uppercase mb-4">
          {content.onThisPage}
        </div>
        <nav className="flex flex-col border-l border-border">
          {toc.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={(event) => scrollToSection(event, item.id)}
              className={`text-[13px] py-1.5 pl-4 -ml-[1px] border-l-2 transition-colors ${
                activeSection === item.id
                  ? 'text-ink border-ink font-medium'
                  : 'text-ink-light border-transparent hover:text-ink'
              }`}
            >
              {item.title}
            </a>
          ))}
        </nav>
      </aside>
    </div>
  );
}
