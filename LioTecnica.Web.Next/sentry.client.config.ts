import * as Sentry from "@sentry/nextjs";

// Sentry é inicializado apenas quando NEXT_PUBLIC_SENTRY_DSN estiver configurado.
// Em desenvolvimento, desabilitado por padrão para não gerar ruído.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
    Sentry.init({
        dsn,
        // Captura 10% das transações de performance em produção
        tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
        // Captura 100% dos replays em erros
        replaysOnErrorSampleRate: 1.0,
        // Captura 0% de replays normais (custo)
        replaysSessionSampleRate: 0,
        environment: process.env.NODE_ENV,
        integrations: [Sentry.replayIntegration()],
    });
}
