import * as Sentry from '@sentry/node';
import { httpIntegration, onUncaughtExceptionIntegration, onUnhandledRejectionIntegration } from '@sentry/node';

export function initSentry() {
  if (!process.env.SENTRY_DSN) {
    console.log('[Sentry] Disabled (no SENTRY_DSN)');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
    environment: process.env.NODE_ENV,
    integrations: [
      httpIntegration(),
      onUncaughtExceptionIntegration(),
      onUnhandledRejectionIntegration(),
    ],
  });

  console.log('[Sentry] Initialized');
}

export function captureError(err: Error, context?: Record<string, any>) {
  if (!process.env.SENTRY_DSN) return;

  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('custom', context);
    }
    Sentry.captureException(err);
  });
}