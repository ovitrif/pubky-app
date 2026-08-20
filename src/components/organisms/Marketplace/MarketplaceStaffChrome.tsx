'use client';

import { MARKETPLACE_ROUTES } from '@/app/routes';
import { Badge } from '@/atoms/Badge/Badge';
import { Link } from '@/atoms/Link/Link';
import { Typography } from '@/atoms/Typography/Typography';
import type { MarketplaceSandboxStaffRole } from '@/libs/commerce/sandbox-actors';
import { isMarketplaceSandboxOperator } from '@/libs/commerce/sandbox-operator';

const STAFF_LINKS: Array<{ href: string; role: MarketplaceSandboxStaffRole; label: string }> = [
  { href: MARKETPLACE_ROUTES.MODERATION, role: 'moderator', label: 'Moderation' },
  { href: MARKETPLACE_ROUTES.SUPPORT, role: 'support', label: 'Support' },
  { href: MARKETPLACE_ROUTES.RISK, role: 'risk', label: 'Risk' },
  { href: MARKETPLACE_ROUTES.FINANCE, role: 'finance', label: 'Finance' },
];

export function MarketplaceStaffChrome({
  role,
  description,
}: {
  role: MarketplaceSandboxStaffRole;
  description: string;
}) {
  return (
    <div className="grid gap-3">
      {isMarketplaceSandboxOperator() && (
        <Badge className="w-fit" variant="outline">
          Sandbox operator · {role}
        </Badge>
      )}
      <Typography as="p" className="text-muted-foreground">
        {description}
      </Typography>
      <nav aria-label="Sandbox staff consoles" className="flex flex-wrap gap-3 text-sm">
        {STAFF_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            overrideDefaults
            className={link.role === role ? 'font-semibold text-brand' : 'text-muted-foreground'}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
