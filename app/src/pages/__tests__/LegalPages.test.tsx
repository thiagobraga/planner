import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { I18nProvider } from '../../i18n/I18nContext';
import { PrivacyPage } from '../PrivacyPage';
import { TermsPage } from '../TermsPage';

let observers: IntersectionObserver[] = [];

beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    vi.fn(function () {
      const instance = {
        observe: vi.fn(),
        disconnect: vi.fn(),
        unobserve: vi.fn(),
      };
      observers.push(instance as unknown as IntersectionObserver);
      return instance;
    }),
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
  observers = [];
});

beforeEach(() => {
  window.localStorage.removeItem('planner_locale');
});

describe('PrivacyPage', () => {
  it('renders Privacy Policy heading structure, data collection table, cookie policy, and user rights', () => {
    render(
      <MemoryRouter initialEntries={['/privacy']}>
        <I18nProvider>
          <PrivacyPage />
        </I18nProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Data We Collect & Legal Basis' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Data Not Collected' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Third-Party Data Processors' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Cookie Policy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Your Rights/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Data Retention' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Data Security' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Contact & Data Protection Officer/i })).toBeInTheDocument();

    // Data collection table entries
    expect(screen.getByText('Email address')).toBeInTheDocument();
    expect(screen.getByText('Google Calendar tokens')).toBeInTheDocument();
    expect(screen.getByText(/Art\. 6\(1\)\(a\) - explicit consent/)).toBeInTheDocument();

    // Cookie policy entries
    expect(screen.getByText(/planner_session/)).toBeInTheDocument();
    expect(screen.getByText(/planner_csrf/)).toBeInTheDocument();
    expect(screen.getByText(/No cookie consent banner is required/i)).toBeInTheDocument();

    // Table of contents
    expect(screen.getByText('On This Page')).toBeInTheDocument();
  });

  it('scrolls to section when a TOC link is clicked', () => {
    render(
      <MemoryRouter initialEntries={['/privacy']}>
        <I18nProvider>
          <PrivacyPage />
        </I18nProvider>
      </MemoryRouter>,
    );

    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const cookieTocLink = screen.getByRole('link', { name: 'Cookie Policy' });
    fireEvent.click(cookieTocLink);

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('renders Portuguese content when locale is pt-BR', () => {
    window.localStorage.setItem('planner_locale', 'pt-BR');

    render(
      <MemoryRouter initialEntries={['/privacy']}>
        <I18nProvider>
          <PrivacyPage />
        </I18nProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Política de Privacidade' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Dados Coletados e Base Legal' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Política de Cookies' })).toBeInTheDocument();
  });
});

describe('TermsPage', () => {
  it('renders Terms of Service with all sections', () => {
    render(
      <MemoryRouter initialEntries={['/terms']}>
        <I18nProvider>
          <TermsPage />
        </I18nProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '1. Service Description' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '2. User Responsibilities' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '3. Account Termination' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '4. Intellectual Property & Your Data' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '5. Limitation of Liability' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '6. Governing Law' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '7. Changes to Terms' })).toBeInTheDocument();
  });

  it('renders Portuguese Terms of Service when locale is pt-BR', () => {
    window.localStorage.setItem('planner_locale', 'pt-BR');

    render(
      <MemoryRouter initialEntries={['/terms']}>
        <I18nProvider>
          <TermsPage />
        </I18nProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Termos de Serviço' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '1. Descrição do Serviço' })).toBeInTheDocument();
  });
});
