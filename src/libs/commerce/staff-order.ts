export const MARKETPLACE_REDACTED = '[redacted]';
export const MARKETPLACE_REDACTED_CREDENTIAL_ID = '00000000-0000-4000-8000-000000000000';

export interface MarketplaceStaffRedactableOrder {
  deliveryAddress: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    region: string;
    postalCode: string;
    countryCode: string;
  };
  digitalDelivery: { credentialId: string } | null;
  reviews: Array<{ text: string; reply?: string | null }>;
  cancellationReason: string | null;
  dispute: { reason: string; rationale: string | null } | null;
  returnRequest: {
    reason: string;
    inspection: { notes: string } | null;
  } | null;
  externalRefund: { transactionId: string } | null;
}

export function redactMarketplaceOrderForStaff<T extends MarketplaceStaffRedactableOrder>(
  order: T,
  options: { keepRefundEvidence?: boolean } = {},
): T {
  return {
    ...order,
    deliveryAddress: {
      ...order.deliveryAddress,
      name: MARKETPLACE_REDACTED,
      line1: MARKETPLACE_REDACTED,
      line2: '',
      postalCode: MARKETPLACE_REDACTED,
    },
    digitalDelivery: order.digitalDelivery
      ? { ...order.digitalDelivery, credentialId: MARKETPLACE_REDACTED_CREDENTIAL_ID }
      : null,
    reviews: order.reviews.map((review) => ({
      ...review,
      text: MARKETPLACE_REDACTED,
      reply: review.reply ? MARKETPLACE_REDACTED : review.reply,
    })),
    cancellationReason: order.cancellationReason ? MARKETPLACE_REDACTED : null,
    dispute: order.dispute
      ? {
          ...order.dispute,
          reason: MARKETPLACE_REDACTED,
          rationale: order.dispute.rationale ? MARKETPLACE_REDACTED : null,
        }
      : null,
    returnRequest: order.returnRequest
      ? {
          ...order.returnRequest,
          reason: MARKETPLACE_REDACTED,
          inspection: order.returnRequest.inspection
            ? { ...order.returnRequest.inspection, notes: MARKETPLACE_REDACTED }
            : null,
        }
      : null,
    externalRefund:
      order.externalRefund && !options.keepRefundEvidence
        ? { ...order.externalRefund, transactionId: MARKETPLACE_REDACTED }
        : order.externalRefund,
  };
}

export function orderContainsStaffSecrets(order: MarketplaceStaffRedactableOrder): boolean {
  const values = [
    order.deliveryAddress.name,
    order.deliveryAddress.line1,
    order.deliveryAddress.postalCode,
    order.digitalDelivery?.credentialId,
    ...order.reviews.flatMap((review) => [review.text, review.reply]),
    order.cancellationReason,
    order.dispute?.reason,
    order.dispute?.rationale,
    order.returnRequest?.reason,
    order.returnRequest?.inspection?.notes,
  ];
  return values.some((value) =>
    Boolean(value && value !== MARKETPLACE_REDACTED && value !== MARKETPLACE_REDACTED_CREDENTIAL_ID),
  );
}
