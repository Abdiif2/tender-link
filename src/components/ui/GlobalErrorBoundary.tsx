import React from 'react';
import { StateBanner } from './StateBanner';
import { translations } from '../../i18n/translations';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled UI error caught by GlobalErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      const lang = document.documentElement.lang === 'am' ? 'am' : 'en';
      const t = translations[lang].states;
      return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
          <div className="max-w-lg w-full">
            <StateBanner
              variant="error"
              title={t.boundaryTitle}
              description={t.boundaryBody}
              actionLabel={t.reloadApp}
              onAction={() => window.location.reload()}
            />
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
