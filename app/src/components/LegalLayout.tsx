import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import type { LegalLayoutProps, LegalTextSection } from '../types/legal';
import './LegalLayout.css';

export function LegalSectionHeading({ title }: { title: string }) {
  return (
    <h2 className="text-[11px] font-medium tracking-widest text-ink-light uppercase mb-6 flex items-center">
      <span>{title}</span>
      <span className="flex-1 h-px bg-border ml-4" aria-hidden="true" />
    </h2>
  );
}

export function LegalProseSection({ section }: { section: LegalTextSection }) {
  return (
    <section id={section.id} className="mb-12">
      <LegalSectionHeading title={section.title} />
      {section.paragraphs?.map((paragraph) => (
        <p key={paragraph} className="mb-4 text-sm leading-6 text-ink">
          {paragraph}
        </p>
      ))}
      {section.items && (
        <ul className="list-none space-y-3">
          {section.items.map((item) => (
            <li
              key={item}
              className="pl-6 relative text-sm leading-6 text-ink before:content-['•'] before:absolute before:left-0 before:text-ink"
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function LegalLayout({
  title,
  subtitle,
  lastUpdated,
  onThisPage,
  backToPlanner,
  toc,
  children,
}: LegalLayoutProps) {
  const { locale, setLocale, t } = useI18n();
  const [activeSection, setActiveSection] = useState(toc[0]?.id ?? '');

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
  }, [toc]);

  const scrollToSection = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      window.history.pushState(null, '', `#${id}`);
      setActiveSection(id);
    }
  };

  return (
    <div className="legal-page min-h-dvh w-full bg-[var(--planner-page-bg)] text-ink px-6 py-12">
      <div className="mx-auto max-w-[980px]">
        <div className="legal-no-print mb-12 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[13px] leading-6 text-ink-light hover:text-ink transition-colors duration-[var(--motion-fast)]"
          >
            <ArrowLeft size={14} />
            <span>{backToPlanner}</span>
          </Link>

          <div className="flex items-center gap-6">
            <nav aria-label="Legal navigation" className="flex items-center gap-4">
              <Link
                to="/privacy"
                className="text-[13px] leading-6 text-ink-light hover:text-ink underline underline-offset-2"
              >
                {t('auth.privacyPolicy')}
              </Link>
              <Link
                to="/terms"
                className="text-[13px] leading-6 text-ink-light hover:text-ink underline underline-offset-2"
              >
                {t('auth.termsOfService')}
              </Link>
            </nav>

            <div className="flex items-center gap-1 rounded-[4px] border border-border p-0.5" role="group" aria-label="Language">
              <button
                type="button"
                onClick={() => setLocale('en')}
                aria-pressed={locale === 'en'}
                className={`px-2 py-0.5 text-[11px] leading-5 rounded-[3px] transition-colors ${
                  locale === 'en'
                    ? 'bg-[var(--planner-sidebar-active-bg)] font-medium text-ink'
                    : 'bg-transparent text-ink-light hover:text-ink'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLocale('pt-BR')}
                aria-pressed={locale === 'pt-BR'}
                className={`px-2 py-0.5 text-[11px] leading-5 rounded-[3px] transition-colors ${
                  locale === 'pt-BR'
                    ? 'bg-[var(--planner-sidebar-active-bg)] font-medium text-ink'
                    : 'bg-transparent text-ink-light hover:text-ink'
                }`}
              >
                PT-BR
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-start">
          <main className="flex-1 min-w-0 max-w-[720px] pb-24">
            <header className="mb-12">
              <h1 className="text-xl leading-6 font-semibold text-ink mb-2">{title}</h1>
              <p className="text-[13px] leading-6 text-ink-light opacity-80">{subtitle}</p>
              <p className="text-[12px] leading-6 text-ink-light opacity-60 mt-1">{lastUpdated}</p>
            </header>

            {children}
          </main>

          <aside className="legal-no-print hidden lg:block w-[220px] shrink-0 sticky top-12 self-start ml-12">
            <div className="text-[11px] font-medium tracking-widest text-ink-light uppercase mb-4">
              {onThisPage}
            </div>
            <nav aria-label={onThisPage} className="flex flex-col border-l border-border">
              {toc.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(event) => scrollToSection(event, item.id)}
                  className={`text-[13px] leading-6 py-1.5 pl-4 -ml-[1px] border-l-2 transition-colors ${
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
      </div>
    </div>
  );
}
