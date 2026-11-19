import { Component, type ErrorInfo, type ReactNode } from 'react';
import { defaultResources, detectInitialLocale } from '../i18n/i18n';

interface State {
  failed: boolean;
}

// Sits above I18nProvider, so it reads the catalog directly.
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render failed', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const catalog = defaultResources[detectInitialLocale()].translation;
    return (
      <div role="alert" className="flex h-screen flex-col items-center justify-center gap-6 text-ink">
        <p>{catalog['error.boundary.title']}</p>
        <button type="button" className="underline" onClick={() => window.location.reload()}>
          {catalog['error.boundary.reload']}
        </button>
      </div>
    );
  }
}
