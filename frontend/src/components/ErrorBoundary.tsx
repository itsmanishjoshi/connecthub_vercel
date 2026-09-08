import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'app' | 'feature' | 'component';
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export interface ErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  reset: () => void;
  level?: 'app' | 'feature' | 'component';
}

/**
 * Error Boundary Component
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI.
 * 
 * Usage:
 * ```tsx
 * <ErrorBoundary level="feature" onError={logError}>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Update state with error info
    this.setState({
      errorInfo,
    });

    // TODO: Log to error monitoring service (e.g., Sentry, LogRocket)
    // logErrorToService(error, errorInfo);
  }

  reset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent
            error={this.state.error}
            errorInfo={this.state.errorInfo}
            reset={this.reset}
            level={this.props.level}
          />
        );
      }

      // Use default fallback
      return (
        <DefaultErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          reset={this.reset}
          level={this.props.level}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Default Error Fallback Component
 * 
 * Displays a user-friendly error message with recovery options
 */
function DefaultErrorFallback({ error, errorInfo, reset, level = 'component' }: ErrorFallbackProps): JSX.Element {
  const isAppLevel = level === 'app';
  const isFeatureLevel = level === 'feature';

  return (
    <div className={`flex items-center justify-center ${isAppLevel ? 'min-h-screen' : 'min-h-[400px]'} p-4 bg-gray-50 dark:bg-gray-900`}>
      <Card className="max-w-2xl w-full p-8">
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isAppLevel ? 'Something went wrong' : isFeatureLevel ? 'Feature unavailable' : 'Component error'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {isAppLevel
                ? 'We encountered an unexpected error. Please try refreshing the page.'
                : isFeatureLevel
                ? 'This feature is temporarily unavailable. You can continue using other parts of the app.'
                : 'This component encountered an error. Please try again.'}
            </p>
          </div>

          {/* Error Details (Development Only) */}
          {process.env.NODE_ENV === 'development' && (
            <details className="w-full text-left">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                Error Details (Development Only)
              </summary>
              <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-auto max-h-64">
                <p className="text-sm font-mono text-red-600 dark:text-red-400 mb-2">
                  {error.toString()}
                </p>
                {errorInfo && (
                  <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {errorInfo.componentStack}
                  </pre>
                )}
              </div>
            </details>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button
              onClick={reset}
              className="flex items-center gap-2"
              size="lg"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>

            {isAppLevel && (
              <Button
                onClick={() => window.location.href = '/'}
                variant="outline"
                className="flex items-center gap-2"
                size="lg"
              >
                <Home className="w-4 h-4" />
                Go Home
              </Button>
            )}

            {!isAppLevel && (
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="flex items-center gap-2"
                size="lg"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Page
              </Button>
            )}
          </div>

          {/* Help Text */}
          <p className="text-sm text-gray-500 dark:text-gray-400">
            If this problem persists, please contact support or try again later.
          </p>
        </div>
      </Card>
    </div>
  );
}

/**
 * Hook to use error boundary imperatively
 * 
 * Usage:
 * ```tsx
 * const throwError = useErrorHandler();
 * 
 * try {
 *   // risky operation
 * } catch (error) {
 *   throwError(error);
 * }
 * ```
 */
export function useErrorHandler(): (error: Error) => void {
  const [, setError] = React.useState<Error | null>(null);

  return React.useCallback((error: Error) => {
    setError(() => {
      throw error;
    });
  }, []);
}
