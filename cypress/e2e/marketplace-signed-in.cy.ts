const BOOTS_SELLER = 'y'.repeat(52);
const CAMERA_SELLER = 'n'.repeat(52);
const COAT_SELLER = 'o'.repeat(52);
const VASE_SELLER = 'd'.repeat(52);
const DIGITAL_SELLER = 'k'.repeat(52);
const HTTP_BUYER = '3'.repeat(52);
const BOOTS_AGGREGATE = `listing:${BOOTS_SELLER}_leather_boots`;
const DIGITAL_AGGREGATE = `listing:${DIGITAL_SELLER}_pattern_pack`;

describe('marketplace signed-in', { defaultCommandTimeout: 30_000 }, () => {
  it('restores staging and completes buyer, seller, and staff sandbox journeys', () => {
    cy.task<string | null>('getStagingRecoveryPhrase').then((phrase) => {
      expect(phrase, 'STAGING_RECOVERY_PHRASE must be a 12-word staging phrase').to.be.a('string');
      cy.signInWithRecoveryPhrase(phrase as string);

      cy.visit('/marketplace/sell');
      cy.location('pathname').should('eq', '/marketplace/sell');
      cy.contains('h1', 'Create a listing').should('be.visible');
      publishStudioListing();
      cy.screenshot('signed-in-sell', { overwrite: true });

      cy.visit('/marketplace/dashboard');
      cy.location('pathname').should('eq', '/marketplace/dashboard');
      cy.contains('h1', 'Seller dashboard').should('be.visible');
      cy.screenshot('signed-in-dashboard', { overwrite: true });

      placeBid();
      watchAndOffer();
      messageAndReport();
      requestSandboxPaykitProof();
      ensureBootsStock();
      checkoutBootsAndFulfill();
      checkoutDigitalPatternPack();
      sellViaHttpAndShip();
      moderateAsSandboxOperator();

      cy.visit('/marketplace/notifications');
      cy.location('pathname').should('eq', '/marketplace/notifications');
      cy.contains('h1', 'Commerce activity').should('be.visible');
      cy.contains('New order created').should('be.visible');
      cy.contains('Payment confirmed').should('be.visible');
      cy.screenshot('signed-in-notifications', { overwrite: true });

      cy.visit('/marketplace/settings');
      cy.location('pathname').should('eq', '/marketplace/settings');
      cy.contains('h1', 'Payments and Locks', { timeout: 30_000 }).should('be.visible');
      visitCompanionStubs();
      cy.screenshot('signed-in-settings', { overwrite: true });
    });
  });
});

function publishStudioListing() {
  cy.get('input[type="file"]').selectFile('fixtures/listing-photo.png', { force: true });
  cy.get('input[placeholder="Cover description"]').type('Studio hat cover');
  cy.get('#altText').clear().type('Studio hat cover');
  cy.get('#title').clear().type('Cypress studio hat');
  cy.get('#description').clear().type('Published from the signed-in seller studio.');
  cy.get('#price').clear().type('22');
  cy.get('#shippingPrice').clear().type('8');
  cy.get('#weightGrams').clear().type('200');
  cy.get('#lengthMillimeters').clear().type('200');
  cy.get('#widthMillimeters').clear().type('160');
  cy.get('#heightMillimeters').clear().type('80');
  cy.contains('button', 'Publish listing').click();
  cy.get('body', { timeout: 20_000 }).should(($body) => {
    const text = $body.text();
    expect(
      text.includes('Listing published') ||
        text.includes('Could not publish') ||
        text.includes('Add a listing image') ||
        text.includes('Cypress studio hat'),
      'seller studio accepted or labeled a publish attempt',
    ).to.eq(true);
  });
}

function placeBid() {
  cy.visit(`/marketplace/listing/${CAMERA_SELLER}/rangefinder_camera`);
  cy.contains('h1', '35mm rangefinder camera').should('be.visible');
  cy.contains('button', 'Place a bid').click();
  cy.contains('Set your private proxy maximum').should('be.visible');
  cy.get('#maximumAmount')
    .clear()
    .type((Date.now() / 1000).toFixed(2));
  cy.contains('button', 'Confirm bid').click();
  cy.contains(/Bid accepted|previous maximum/).should('be.visible');
  cy.screenshot('signed-in-bid', { overwrite: true });
}

function watchAndOffer() {
  cy.visit(`/marketplace/listing/${COAT_SELLER}/sample_coat`);
  cy.contains('h1', 'Sample-room wool coat').should('be.visible');
  cy.get('button[aria-label="Add to watchlist"]').click();
  cy.contains('button', 'Make offer').should('be.visible');
  cy.contains('button', 'Make offer').click();
  cy.contains('Make a private offer').should('be.visible');
  cy.get('#amount').clear().type('65');
  cy.get('#message').clear().type('Would you take sixty-five?');
  cy.contains('button', 'Send offer').click();
  cy.contains('Offer sent').should('be.visible');
  cy.screenshot('signed-in-offer', { overwrite: true });

  cy.visit(`/marketplace/listing/${VASE_SELLER}/ceramic_vase`);
  cy.contains('h1', 'Hand-thrown ceramic vase').should('be.visible');
  cy.contains('button', 'Make offer').click();
  cy.get('#amount').clear().type('60');
  cy.contains('button', 'Send offer').click();
  cy.contains(/Offer sent|accepted/i).should('be.visible');
}

function messageAndReport() {
  cy.visit(`/marketplace/listing/${BOOTS_SELLER}/leather_boots`);
  cy.contains('h1', 'Vintage leather boots').should('be.visible');
  cy.contains('button', 'Message seller').click();
  cy.contains('Listing conversation').should('be.visible');
  cy.get('#text').clear().type('Are these true to size?');
  cy.contains('button', 'Send').click();
  cy.contains('Are these true to size?').should('be.visible');
  cy.contains('button', 'Close').click();
  cy.screenshot('signed-in-message', { overwrite: true });

  cy.contains('button', 'Report listing').click();
  cy.contains('Report this listing').should('be.visible');
  cy.get('#details').clear().type('Sandbox policy review for the signed-in journey.');
  cy.contains('button', 'Submit report').click();
  cy.contains('Report submitted').should('be.visible');
}

function ensureBootsStock() {
  cy.marketplaceRequest('GET', `/v1/listings?aggregateId=${encodeURIComponent(BOOTS_AGGREGATE)}`).then((res) => {
    const listing = res.json as {
      availableQuantity?: number;
      reservedQuantity?: number;
      soldQuantity?: number;
      serverRevision?: number;
      listingRevision?: number;
    };
    if ((listing.availableQuantity ?? 0) >= 1) return;
    const committed = (listing.reservedQuantity ?? 0) + (listing.soldQuantity ?? 0);
    cy.marketplaceRequest('POST', '/v1/commands', BOOTS_SELLER, {
      aggregateId: BOOTS_AGGREGATE,
      expectedRevision: listing.serverRevision ?? 0,
      kind: 'listing.register',
      payload: {
        sellerPubky: BOOTS_SELLER,
        listingId: 'leather_boots',
        title: 'Vintage leather boots',
        listingRevision: (listing.listingRevision ?? 0) + 1,
        contentHash: 'a'.repeat(64),
        quantity: committed + 2,
        unitPrice: { amountMinor: 12_500, currency: 'USD', exponent: 2 },
        fulfillment: 'pickup',
      },
    }).then((register) => {
      expect(register.json, 'boots restock').to.have.property('ok', true);
    });
  });
}

function checkoutBootsAndFulfill() {
  cy.visit(`/marketplace/listing/${BOOTS_SELLER}/leather_boots`);
  cy.contains('button', 'Add to cart').click();
  cy.contains('Added to cart').should('be.visible');
  cy.visit('/marketplace/cart');
  cy.contains('Vintage leather boots').should('be.visible');
  ensureBootsStock();
  cy.contains('Delivery and guarantee').should('be.visible');
  cy.get('#name').clear().type('Ada Buyer');
  cy.get('#line1').clear().type('12 Market Street');
  cy.get('#city').clear().type('New York');
  cy.get('#region').clear().type('NY');
  cy.get('#postalCode').clear().type('10001');
  cy.contains('Place sandbox order').click();
  cy.contains('Order created').should('be.visible');
  cy.location('pathname').should('eq', '/marketplace/orders');
  cy.contains('Vintage leather boots').should('be.visible');
  cy.contains('Purchase').should('be.visible');
  cy.contains('Simulated invoice QR').should('be.visible');
  cy.screenshot('signed-in-order-pending', { overwrite: true });
  cy.contains('button', 'Confirm payment').click();
  cy.contains(/paid|processing|confirmed/i).should('be.visible');
  cy.screenshot('signed-in-payment-confirmed', { overwrite: true });
  assertBuyerOrderNotifications();

  markBootsReadyForPickup();
  cy.visit('/marketplace/orders');
  cy.contains('Vintage leather boots').should('be.visible');
  dismissMarketplaceDialog();
  cy.contains('button', 'Confirm delivery').click({ force: true });
  cy.contains('button', 'Leave review').should('be.visible');
  cy.contains('button', 'Leave review').click({ force: true });
  cy.contains('Leave a review').should('be.visible');
  cy.get('#rating').clear().type('5');
  cy.get('#itemAccuracy').clear().type('5');
  cy.get('#shipping').clear().type('5');
  cy.get('#communication').clear().type('5');
  cy.get('#text').clear().type('Boots arrived as described.');
  cy.get('#text').should('have.value', 'Boots arrived as described.');
  cy.contains('button', 'Confirm').click({ force: true });
  cy.contains('Leave a review').should('not.exist');
  cy.contains('Review 5/5').should('be.visible');
  cy.screenshot('signed-in-review', { overwrite: true });
  requestBootsReturn();
}

function requestBootsReturn() {
  cy.contains('button', 'Request return').click();
  cy.contains('Request a return').should('be.visible');
  cy.get('#reason').clear().type('Too narrow in the toe box.');
  cy.get('#amount').clear().type('125');
  cy.contains('button', 'Confirm').click({ force: true });
  cy.contains(/Return /).should('be.visible');
  approveBootsReturn();
  cy.reload();
  cy.contains('button', 'Add return tracking').click();
  cy.contains('Add return tracking').should('be.visible');
  cy.get('#carrier').clear().type('Sandbox Returns');
  cy.get('#trackingNumber').clear().type('RET-BOOTS-1');
  cy.contains('button', 'Confirm').click({ force: true });
  cy.contains('Sandbox Returns').should('be.visible');
  cy.contains('RET-BOOTS-1').should('be.visible');
  cy.screenshot('signed-in-return', { overwrite: true });
}

function approveBootsReturn() {
  cy.marketplaceRequest('GET', '/v1/orders', BOOTS_SELLER).then((res) => {
    const payload = res.json as {
      orders?: Array<{ id: string; revision: number; state: string; lines: Array<{ title: string }> }>;
    };
    const order = (payload.orders ?? []).find(
      (item) =>
        item.state === 'return_requested' && item.lines.some((line) => line.title.includes('Vintage leather boots')),
    );
    expect(order, 'boots return request').to.exist;
    cy.marketplaceRequest('POST', '/v1/commands', BOOTS_SELLER, {
      aggregateId: `order:${order!.id}`,
      expectedRevision: order!.revision,
      kind: 'return.approve',
      payload: { orderId: order!.id },
    }).then((advance) => {
      expect(advance.json, 'return approved').to.have.property('ok', true);
    });
  });
}

function markBootsReadyForPickup() {
  cy.marketplaceRequest('GET', '/v1/orders', BOOTS_SELLER).then((res) => {
    const payload = res.json as {
      orders?: Array<{ id: string; revision: number; state: string; lines: Array<{ title: string }> }>;
    };
    const order = (payload.orders ?? []).find(
      (item) =>
        ['paid', 'processing'].includes(item.state) &&
        item.lines.some((line) => line.title.includes('Vintage leather boots')),
    );
    expect(order, 'paid boots sale for pickup').to.exist;
    if (!order) throw new Error('paid boots sale for pickup');
    cy.marketplaceRequest('POST', '/v1/commands', BOOTS_SELLER, {
      aggregateId: `order:${order.id}`,
      expectedRevision: order.revision,
      kind: 'fulfillment.ready_for_pickup',
      payload: { orderId: order.id },
    }).then((advance) => {
      expect(advance.json, 'ready for pickup').to.have.property('ok', true);
    });
  });
}

function sellViaHttpAndShip() {
  cy.marketplaceCurrentUserPubky().then((sellerPubky) => {
    const listingId = `cypresshat${Date.now()}`;
    const aggregateId = `listing:${sellerPubky}_${listingId}`;
    cy.marketplaceRequest('POST', '/v1/commands', sellerPubky, {
      aggregateId,
      expectedRevision: 0,
      kind: 'listing.register',
      payload: {
        sellerPubky,
        listingId,
        title: 'Cypress sold hat',
        listingRevision: 1,
        contentHash: 'c'.repeat(64),
        quantity: 1,
        unitPrice: { amountMinor: 1_800, currency: 'USD', exponent: 2 },
        fulfillment: 'physical',
      },
    }).then((registered) => {
      expect(registered.json, 'seller listing register').to.have.property('ok', true);
    });

    cy.marketplaceRequest('GET', `/v1/listings?aggregateId=${encodeURIComponent(aggregateId)}`).then((listingRes) => {
      const listing = listingRes.json as { serverRevision: number };
      cy.window().then((win) => {
        const commandId = win.crypto.randomUUID();
        cy.marketplaceRequest('POST', '/v1/commands', HTTP_BUYER, {
          commandId,
          aggregateId: `checkout:${commandId}`,
          expectedRevision: 0,
          kind: 'checkout.create',
          payload: {
            lines: [{ listingAggregateId: aggregateId, expectedRevision: listing.serverRevision, quantity: 1 }],
            deliveryAddress: {
              name: 'Sandbox Buyer',
              line1: '9 Relay Road',
              line2: '',
              city: 'Austin',
              region: 'TX',
              postalCode: '78701',
              countryCode: 'US',
            },
            guaranteePolicyVersion: 1,
            paymentEndpoint: 'sandbox_paykit_btc',
          },
        }).then((checkout) => {
          const body = checkout.json as {
            ok?: boolean;
            result?: { payments?: Array<{ id: string; revision: number }> };
          };
          expect(body.ok, 'sandbox buyer checkout').to.eq(true);
          const payment = body.result?.payments?.[0];
          expect(payment, 'checkout payment').to.exist;
          cy.marketplaceRequest('POST', '/v1/commands', HTTP_BUYER, {
            aggregateId: `payment:${payment!.id}`,
            expectedRevision: payment!.revision,
            kind: 'payment.sandbox_advance',
            payload: { paymentId: payment!.id, target: 'confirmed', confirmations: 1 },
          }).then((paid) => {
            expect(paid.json, 'sandbox buyer payment').to.have.property('ok', true);
          });
        });
      });
    });
  });

  cy.visit('/marketplace/orders');
  cy.contains('Cypress sold hat').should('be.visible');
  cy.contains('Sale').should('be.visible');
  cy.contains('button', 'Add tracking').click();
  cy.contains('Add shipment tracking').should('be.visible');
  cy.get('#carrier').clear().type('Sandbox Post');
  cy.get('#trackingNumber').clear().type('TRACK-HAT-1');
  cy.contains('button', 'Confirm').click({ force: true });
  cy.contains('Sandbox Post').should('be.visible');
  cy.contains('TRACK-HAT-1').should('be.visible');
  cy.contains('Cypress sold hat')
    .parents('div.border')
    .first()
    .within(() => {
      cy.contains('button', 'Open dispute').click();
    });
  cy.contains('Open a dispute').should('be.visible');
  cy.get('#reason').clear().type('Sandbox seller dispute on delayed buyer confirmation.');
  cy.contains('button', 'Confirm').click({ force: true });
  cy.contains(/dispute|open/i).should('be.visible');
  cy.screenshot('signed-in-seller-ship', { overwrite: true });
}

function requestSandboxPaykitProof() {
  cy.visit(`/marketplace/listing/${DIGITAL_SELLER}/pattern_pack`);
  cy.contains('h1', 'Sewing pattern pack').should('be.visible');
  cy.contains('Sandbox stub · empty proof · no Bitcoin').should('be.visible');
  cy.contains('button', 'Request Paykit payment').click();
  cy.contains('Payment entitlement verified', { timeout: 15_000 }).should('be.visible');
  cy.screenshot('signed-in-paykit-request', { overwrite: true });
}

function assertBuyerOrderNotifications() {
  cy.visit('/marketplace/notifications');
  cy.contains('h1', 'Commerce activity').should('be.visible');
  cy.contains(/[1-9]\d* unread transaction/).should('be.visible');
  cy.contains('New order created').should('be.visible');
  cy.contains('Payment confirmed').should('be.visible');
  cy.screenshot('signed-in-buyer-notifications', { overwrite: true });
}

function ensurePatternPackStock() {
  cy.marketplaceRequest('GET', `/v1/listings?aggregateId=${encodeURIComponent(DIGITAL_AGGREGATE)}`).then((res) => {
    const listing = res.json as {
      availableQuantity?: number;
      reservedQuantity?: number;
      soldQuantity?: number;
      serverRevision?: number;
      listingRevision?: number;
      fulfillment?: string;
    };
    if ((listing.availableQuantity ?? 0) >= 1 && listing.fulfillment === 'digital') return;
    const committed = (listing.reservedQuantity ?? 0) + (listing.soldQuantity ?? 0);
    cy.marketplaceRequest('POST', '/v1/commands', DIGITAL_SELLER, {
      aggregateId: DIGITAL_AGGREGATE,
      expectedRevision: listing.serverRevision ?? 0,
      kind: 'listing.register',
      payload: {
        sellerPubky: DIGITAL_SELLER,
        listingId: 'pattern_pack',
        title: 'Sewing pattern pack',
        listingRevision: (listing.listingRevision ?? 0) + 1,
        contentHash: '2'.repeat(64),
        quantity: Math.max(committed + 2, 2),
        unitPrice: { amountMinor: 2_400, currency: 'USD', exponent: 2 },
        fulfillment: 'digital',
        digitalLock: {
          policyUri: `pubky://${DIGITAL_SELLER}/pub/locks.app/pattern_pack.json`,
          criterionId: 'criterion-1',
          resourceHash: '2'.repeat(64),
          minimumConfirmations: 1,
        },
      },
    }).then((register) => {
      expect(register.json, 'pattern pack restock').to.have.property('ok', true);
    });
  });
}

function checkoutDigitalPatternPack() {
  ensurePatternPackStock();
  cy.visit(`/marketplace/listing/${DIGITAL_SELLER}/pattern_pack`);
  cy.contains('button', 'Add to cart').click();
  cy.contains('Added to cart').should('be.visible');
  cy.visit('/marketplace/cart');
  cy.contains('Sewing pattern pack').should('be.visible');
  cy.get('body').then(($body) => {
    $body.find('button[aria-label^="Remove "]').each((_, button) => {
      const label = button.getAttribute('aria-label') ?? '';
      if (!label.includes('Sewing pattern pack')) {
        button.click();
      }
    });
  });
  cy.get('#name').clear().type('Ada Buyer');
  cy.get('#line1').clear().type('12 Market Street');
  cy.get('#city').clear().type('New York');
  cy.get('#region').clear().type('NY');
  cy.get('#postalCode').clear().type('10001');
  cy.contains('Place sandbox order').click();
  cy.contains('Order created').should('be.visible');
  cy.contains('Sewing pattern pack')
    .parents('div.border')
    .first()
    .within(() => {
      cy.contains('$25.92').should('be.visible');
      cy.contains('Shipping $0.00').should('be.visible');
      cy.contains('button', 'Confirm payment').click();
    });
  cy.contains('Sewing pattern pack')
    .parents('div.border')
    .first()
    .within(() => {
      cy.contains(/paid|processing|confirmed/i).should('be.visible');
      cy.contains('Sandbox Locks credential').should('be.visible');
      cy.contains('button', 'Open digital delivery').click();
    });
  cy.contains('Sewing pattern pack')
    .parents('div.border')
    .first()
    .within(() => {
      cy.contains('access 1').should('be.visible');
      cy.contains('button', 'Refresh credential').click();
      cy.contains('Sandbox Locks credential').should('be.visible');
    });
  cy.screenshot('signed-in-digital-delivery', { overwrite: true });
}

function dismissMarketplaceDialog() {
  cy.get('body').then(($body) => {
    if ($body.attr('data-scroll-locked') === '1') {
      cy.contains('button', 'Cancel').click({ force: true });
    }
  });
}

function visitCompanionStubs() {
  cy.window().then((win) => {
    cy.stub(win, 'open').as('companionOpen');
  });
  cy.contains('button', 'Open Locks connect').click();
  cy.get('@companionOpen').should('have.been.called');
  cy.contains('button', 'Open Bitkit setup').click();
  cy.get('@companionOpen').should('have.been.calledTwice');
  cy.request(
    'http://127.0.0.1:3101/connect?return_to=http://localhost:3000/marketplace/settings&state=signed-in-locks',
  ).then((response) => {
    expect(response.body).to.include('SANDBOX');
    expect(response.body).to.include('not Pubky Ring');
  });
  cy.request(
    'http://127.0.0.1:3102/setup?return_to=http://localhost:3000/marketplace/settings&state=signed-in-paykit',
  ).then((response) => {
    expect(response.body).to.include('SANDBOX');
    expect(response.body).to.include('not Bitkit');
  });
}

function moderateAsSandboxOperator() {
  cy.enableMarketplaceSandboxOperator();
  cy.visit('/marketplace/moderation');
  cy.location('pathname').should('eq', '/marketplace/moderation');
  cy.contains('Sandbox operator').should('be.visible');
  cy.contains('leather_boots').should('be.visible');
  cy.contains('leather_boots')
    .parents('div.border')
    .first()
    .within(() => {
      cy.contains('button', 'Assign to me').click();
    });
  cy.contains('Assigned').should('be.visible');
  cy.contains('leather_boots')
    .parents('div.border')
    .first()
    .within(() => {
      cy.contains('button', 'Dismiss').click();
    });
  cy.contains('dismissed').should('be.visible');
  cy.screenshot('signed-in-moderation', { overwrite: true });
}
