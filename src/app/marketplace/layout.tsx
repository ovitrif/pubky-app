import type { ReactNode } from 'react';

/**
 * Scoped muted-foreground override so marketplace body copy meets WCAG AA on
 * `--card` without changing the global social-app token (VRT-sensitive).
 */
export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  return <div className="[--muted-foreground:#b4b4bb]">{children}</div>;
}
