import { formatCommerceMoney } from '@/libs/commerce/format';
import type { MarketplaceOrder } from '@/services/marketplace/marketplace';

export function printMarketplacePackingSlip(order: MarketplaceOrder): void {
  const lines = order.lines
    .map(
      (line) =>
        `<tr><td>${escapeHtml(line.title)}</td><td>${line.quantity}</td><td>${formatCommerceMoney(line.unitPrice)}</td></tr>`,
    )
    .join('');
  const address = order.deliveryAddress
    ? [
        order.deliveryAddress.name,
        order.deliveryAddress.line1,
        order.deliveryAddress.line2,
        `${order.deliveryAddress.city}, ${order.deliveryAddress.region} ${order.deliveryAddress.postalCode}`,
        order.deliveryAddress.countryCode,
      ]
        .filter(Boolean)
        .map((part) => escapeHtml(String(part)))
        .join('<br />')
    : 'No delivery address on this sandbox order.';
  const html = `<!doctype html><html><head><title>Packing slip ${escapeHtml(order.id)}</title>
<style>body{font-family:sans-serif;padding:24px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}</style>
</head><body>
<h1>Sandbox packing slip</h1>
<p>Order ${escapeHtml(order.id)} · ${escapeHtml(order.state.replaceAll('_', ' '))}</p>
<p><strong>Ship to</strong><br />${address}</p>
<table><thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead><tbody>${lines}</tbody></table>
<p>Total ${formatCommerceMoney(order.total)}</p>
<p>This is a sandbox packing summary. It is not a carrier label and moves no funds.</p>
</body></html>`;
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=720,height=900');
  if (!popup) return;
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  popup.print();
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
