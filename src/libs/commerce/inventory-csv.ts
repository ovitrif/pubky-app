import type { CommerceListingModelSchema } from '@/models/commerce/commerce.schema';

export interface MarketplaceInventoryCsvRow {
  listingId: string;
  title: string;
  state: 'active' | 'paused' | 'ended' | 'removed';
  format: string;
  priceMinor: number;
  currency: string;
  inventory: number;
}

export function exportMarketplaceInventoryCsv(listings: CommerceListingModelSchema[]): string {
  const header = ['listing_id', 'title', 'state', 'format', 'price_minor', 'currency', 'inventory'];
  const rows = listings.map((listing) => [
    csvCell(listing.listing_id),
    csvCell(listing.record.title),
    listing.state,
    listing.format,
    String(listing.price_minor),
    listing.currency,
    String(listing.record.variants.reduce((total, variant) => total + variant.quantity, 0)),
  ]);
  return [header.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

export function parseMarketplaceInventoryCsv(text: string): MarketplaceInventoryCsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  return lines.slice(1).flatMap((line) => {
    const cells = splitCsvLine(line);
    const [listingId, title, state, format, priceMinor, currency, inventory] = cells;
    if (!listingId || !['active', 'paused', 'ended', 'removed'].includes(state ?? '')) return [];
    return [
      {
        listingId,
        title: title ?? '',
        state: state as MarketplaceInventoryCsvRow['state'],
        format: format ?? '',
        priceMinor: Number(priceMinor),
        currency: currency ?? 'USD',
        inventory: Number(inventory),
      },
    ];
  });
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""').replace(/^[=+\-@]/, "'$&")}"`;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (character === ',' && !quoted) {
      cells.push(current);
      current = '';
      continue;
    }
    current += character;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}
