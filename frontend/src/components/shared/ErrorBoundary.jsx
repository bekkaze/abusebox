import React from 'react';
import { secondaryButtonClass } from './ui';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="py-16 max-w-lg">
          <p className="flex items-baseline gap-3">
            <span className="font-mono text-xl font-semibold text-s5">5.x</span>
            <span className="text-xl font-semibold text-ink">This page stopped working</span>
          </p>
          <p className="mt-2 font-mono text-xs text-ink-2 break-words">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className={`${secondaryButtonClass} mt-5`}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
