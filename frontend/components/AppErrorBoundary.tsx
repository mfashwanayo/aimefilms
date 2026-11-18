import React from 'react';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('AimeFilms UI error:', error, info.componentStack);
  }

  private recover = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-[#080b12] px-5 text-white">
          <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121925] p-7 shadow-2xl shadow-black/40">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-400">AimeFilms</p>
            <h1 className="mt-3 text-2xl font-semibold">This page couldn't load</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Something unexpected interrupted the page. Your account and saved catalogue data have not been deliberately changed.
            </p>
            <button
              type="button"
              onClick={this.recover}
              className="mt-6 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
            >
              Reload AimeFilms
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
