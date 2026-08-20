import { quoteSandboxCarrierRate, sandboxReverseLabelId } from '@/libs/commerce/carrier-adapter';
import type { MarketplaceOrder } from '@/services/marketplace/marketplace';

export function printMarketplaceShippingLabel(order: MarketplaceOrder): void {
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
  const html = `<!doctype html><html><head><title>Shipping label ${escapeHtml(order.id)}</title>
<style>
  @page { size: 4in 6in; margin: 0.25in; }
  body { font-family: sans-serif; margin: 0; padding: 16px; }
  .label { border: 2px solid #111; padding: 16px; min-height: 5.2in; }
  h1 { font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 12px; }
  .barcode { font-family: ui-monospace, monospace; font-size: 18px; letter-spacing: 0.2em; border: 1px solid #111; padding: 8px; text-align: center; margin: 16px 0; }
  .note { font-size: 12px; color: #444; }
</style>
</head><body>
<div class="label">
  <h1>Sandbox shipping label</h1>
  <p><strong>Ship to</strong><br />${address}</p>
  <div class="barcode">${escapeHtml(order.id.slice(0, 18).toUpperCase())}</div>
  <p>Order ${escapeHtml(order.id)} · ${escapeHtml(order.state.replaceAll('_', ' '))}</p>
  <p class="note">This is a printable sandbox label. It is not a carrier-scannable label, books no postage, and moves no funds.</p>
</div>
</body></html>`;
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=420,height=640');
  if (!popup) return;
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  popup.print();
}

export function printMarketplaceReverseLabel(order: MarketplaceOrder): void {
  const quote = quoteSandboxCarrierRate({
    direction: 'reverse',
    countryCode: order.deliveryAddress?.countryCode,
  });
  const seller = escapeHtml(order.sellerPubky.slice(0, 8));
  const html = `<!doctype html><html><head><title>Reverse label ${escapeHtml(order.id)}</title>
<style>
  @page { size: 4in 6in; margin: 0.25in; }
  body { font-family: sans-serif; margin: 0; padding: 16px; }
  .label { border: 2px dashed #111; padding: 16px; min-height: 5.2in; }
  h1 { font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 12px; }
  .barcode { font-family: ui-monospace, monospace; font-size: 18px; letter-spacing: 0.2em; border: 1px solid #111; padding: 8px; text-align: center; margin: 16px 0; }
  .note { font-size: 12px; color: #444; }
</style>
</head><body>
<div class="label">
  <h1>Sandbox reverse label</h1>
  <p><strong>Return to seller</strong> ${seller}…</p>
  <div class="barcode">${escapeHtml(sandboxReverseLabelId(order.id))}</div>
  <p>${escapeHtml(quote.carrierLabel)} · ${escapeHtml(quote.adapterVersion)} · zone ${escapeHtml(quote.zone)}</p>
  <p class="note">This is a printable sandbox reverse label. It is not a carrier-scannable label, books no postage, and does not move Bitcoin or issue a refund.</p>
</div>
</body></html>`;
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=420,height=640');
  if (!popup) return;
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  popup.print();
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
