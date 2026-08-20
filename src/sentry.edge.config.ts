/**
 * Sentry init for the Edge runtime (middleware + edge route handlers).
 *
 * Edge init for `src/proxy.ts` (Next.js 16 request proxy) and any future
 * `export const runtime = 'edge'` route. Errors are captured via
 * `instrumentation.ts`'s NEXT_RUNTIME === 'edge' branch.
 */
import * as Sentry from '@sentry/nextjs';
import { getSentryInitBase, shouldEnableSentry } from '@/libs/observability/sentry';

if (shouldEnableSentry()) {
  Sentry.init({
    ...getSentryInitBase(),
  });
}
