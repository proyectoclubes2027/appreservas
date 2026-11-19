import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from './ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturó un error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl flex flex-col items-center">
            <div className="p-3 bg-red-500/15 text-red-400 rounded-full mb-4">
              <AlertTriangle size={36} />
            </div>
            <h2 className="text-lg font-bold text-textPri mb-2">Algo salió mal</h2>
            <p className="text-xs text-textSec mb-6 leading-relaxed">
              Ocurrió un error inesperado. Podés recargar la página para volver a intentar.
            </p>

            {this.state.error && (
              <div className="w-full bg-slate-100 border border-slate-200 rounded-lg p-3 text-left text-[11px] text-red-300 font-mono mb-6 overflow-x-auto max-h-32">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex flex-col gap-2.5 w-full">
              <Button
                variant="primary"
                fullWidth
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 font-bold"
              >
                <RefreshCw size={16} /> Recargar Aplicación
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={this.handleGoHome}
                className="flex items-center justify-center gap-2"
              >
                <Home size={16} /> Ir al Inicio
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
