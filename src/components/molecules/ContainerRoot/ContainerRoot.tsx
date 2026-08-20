import { Inter_Tight } from 'next/font/google';
import Script from 'next/script';
import { Container } from '@/atoms/Container/Container';
import {
  getPlausibleDomain,
  getPlausibleScriptUrl,
  serializeRuntimeConfig,
} from '@/libs/runtime-config/runtime-config';
import { PageContainer } from '../Page/Page';

const interTight = Inter_Tight({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

interface RootContainerProps {
  children: React.ReactNode;
  nonce?: string;
}

export function RootContainer({ children, nonce }: RootContainerProps) {
  const plausibleDomain = getPlausibleDomain();
  const plausibleScriptUrl = getPlausibleScriptUrl();

  return (
    <Container as="html" lang="en-US" dir="ltr">
      <Container as="body" className={`${interTight.variable} antialiased`}>
        {/*
          Publish runtime config before any Next.js bundle executes. This must stay a RAW
          <script> element rendered first in <body>: App Router's next/script with
          strategy="beforeInteractive" serializes inline content into the `self.__next_s`
          queue, which the client runtime executes only AFTER the main bundle's module scope
          — i.e. after instrumentation-client.ts has already evaluated (and missed the
          config, silently disabling client Sentry). A raw inline script is emitted as-is in
          the SSR HTML and executes during document parsing, before any async bundle.
          The per-request nonce comes from `src/proxy.ts` so the enforced document CSP can
          allow this script without 'unsafe-inline'.
        */}
        <script
          id="pubky-runtime-config"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: serializeRuntimeConfig() }}
        />
        {plausibleDomain && plausibleScriptUrl && (
          <Script
            data-domain={plausibleDomain}
            src={plausibleScriptUrl}
            strategy="afterInteractive"
            nonce={nonce}
            // Plausible's pageview-props script extension reads `event-*` attributes off the
            // script tag and attaches them as custom properties to every pageview. The app is
            // US-English only; the constant keeps dashboard continuity for the locale prop.
            {...{ 'event-locale': 'en-US' }}
          />
        )}
        <PageContainer>{children}</PageContainer>
      </Container>
    </Container>
  );
}
