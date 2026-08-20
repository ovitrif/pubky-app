describe('marketplace', () => {
  it('browses the public catalog and filters sandbox inventory', () => {
    cy.visit('/marketplace');
    cy.contains('h1', 'Find something rare.').should('be.visible');
    cy.contains('Pubky Marketplace').should('be.visible');
    cy.get('input[placeholder="Search items, styles, or sellers"]').should('be.visible');

    cy.get('body').then(($body) => {
      if ($body.text().includes('Sandbox · no real funds')) {
        cy.contains('10 items').should('be.visible');
        cy.get('input[placeholder="Search items, styles, or sellers"]').type('camera');
        cy.contains('1 item').should('be.visible');
        cy.contains('35mm rangefinder camera').should('be.visible');
        cy.contains('Vintage leather boots').should('not.exist');
        cy.contains('button', 'Clear').click();
        cy.contains('10 items').should('be.visible');
      } else {
        cy.contains('Marketplace transactions are unavailable in this deployment.').should('be.visible');
      }
    });
  });

  it('shows a captioned listing gallery on a public sandbox item', () => {
    const seller = 'y'.repeat(52);
    cy.visit(`/marketplace/listing/${seller}/leather_boots`);
    cy.contains('h1', 'Vintage leather boots').should('be.visible');
    cy.contains('1 of 2').should('be.visible');
    cy.contains('button', 'Photo 2').click();
    cy.contains('2 of 2').should('be.visible');
    cy.contains('Vintage leather boots detail').should('be.visible');
  });

  it('shows Locks-protected digital delivery on a sandbox digital listing', () => {
    const seller = 'k'.repeat(52);
    cy.visit(`/marketplace/listing/${seller}/pattern_pack`);
    cy.contains('h1', 'Sewing pattern pack').should('be.visible');
    cy.contains('Locks-protected digital delivery').should('be.visible');
    cy.contains('Paykit sends the private Bitcoin request to Bitkit').should('be.visible');
    cy.contains('Sandbox stub · empty proof · no Bitcoin').should('be.visible');
    cy.contains('button', 'Request Paykit payment').should('be.visible');
  });

  it('serves labeled Locks and Paykit sandbox companion stubs', () => {
    cy.request('http://127.0.0.1:3101/health/ready').its('body').should('include', { mode: 'sandbox' });
    cy.request(
      'http://127.0.0.1:3101/connect?return_to=http://localhost:3000/marketplace/settings&state=guest-locks',
    ).then((response) => {
      expect(response.headers['x-locks-mode']).to.eq('sandbox');
      expect(response.body).to.include('SANDBOX');
      expect(response.body).to.include('not Pubky Ring');
    });
    cy.request(
      'http://127.0.0.1:3102/setup?return_to=http://localhost:3000/marketplace/settings&state=guest-paykit',
    ).then((response) => {
      expect(response.headers['x-paykit-mode']).to.eq('sandbox');
      expect(response.body).to.include('SANDBOX');
      expect(response.body).to.include('not Bitkit');
    });
  });

  it('shows a public auction bid history without a proxy maximum', () => {
    const seller = 'n'.repeat(52);
    cy.visit(`/marketplace/listing/${seller}/rangefinder_camera`);
    cy.contains('h1', '35mm rangefinder camera').should('be.visible');
    cy.contains('h2', 'Auction status').should('be.visible');
    cy.contains('Minimum next bid').should('be.visible');
    cy.contains('Sign in to see your standing').should('be.visible');
    cy.contains('h2', 'Bid history').should('be.visible');
    cy.contains('Bid 1').should('be.visible');
    cy.contains('Bid 2').should('be.visible');
    cy.contains('No bids yet').should('not.exist');
    cy.contains('Proxy maximums stay private').should('be.visible');
    cy.contains('Buying policies').should('be.visible');
    cy.contains('maximumAmount').should('not.exist');
    cy.screenshot('auction-status-seeded-bids', { overwrite: true });
  });

  it('shows watcher-only offer and vacation listing surfaces', () => {
    const watcherSeller = 'o'.repeat(52);
    cy.visit(`/marketplace/listing/${watcherSeller}/sample_coat`);
    cy.contains('h1', 'Sample-room wool coat').should('be.visible');
    cy.contains('Watcher-only offer').should('be.visible');
    cy.contains('button', 'Watch to offer').should('be.visible');
    cy.contains('button', 'Add to cart').should('not.exist');

    const vacationSeller = 'd'.repeat(52);
    cy.visit(`/marketplace/listing/${vacationSeller}/ceramic_vase`);
    cy.contains('h1', 'Hand-thrown ceramic vase').should('be.visible');
    cy.contains('Seller is on vacation').should('be.visible');
    cy.contains('Seller auto-accepts offers at or above $60.00').should('be.visible');
    cy.contains('Buying policies').should('be.visible');
    cy.contains('button', 'Share').should('be.visible');
    cy.screenshot('vase-vacation-auto-accept', { overwrite: true });
  });

  it('opens a public shop and filters watcher-only offers', () => {
    const seller = 'y'.repeat(52);
    cy.visit(`/marketplace/shop/${seller}`);
    cy.contains('h1', 'Satoshi Vintage').should('be.visible');
    cy.contains('Buying policies').should('be.visible');
    cy.contains('Vintage leather boots').should('be.visible');
    cy.screenshot('shop-buying-policies', { overwrite: true });

    cy.visit('/marketplace');
    cy.get('body').then(($body) => {
      if ($body.text().includes('Sandbox · no real funds')) {
        cy.get('[aria-label="Sale format"]').click();
        cy.contains('[role="option"]', 'Watcher offers').click();
        cy.contains('Sample-room wool coat').should('be.visible');
        cy.contains('Vintage leather boots').should('not.exist');
      }
    });
  });

  it('lets a guest add a multi-quantity listing to a local cart', () => {
    const seller = 'y'.repeat(52);
    cy.visit(`/marketplace/listing/${seller}/leather_boots`);
    cy.contains('h1', 'Vintage leather boots').should('be.visible');
    cy.contains('4 available').should('be.visible');
    cy.get('button[aria-label="Increase Vintage leather boots quantity"]').click();
    cy.contains('button', 'Add to cart').click();
    cy.contains('Added to cart').should('be.visible');
    cy.visit('/marketplace/cart');
    cy.location('pathname').should('eq', '/marketplace/cart');
    cy.contains('h1', 'Cart').should('be.visible');
    cy.contains('Vintage leather boots').should('be.visible');
    cy.contains('2 items').should('be.visible');
    cy.contains('Sign in to check out').should('be.visible');
    cy.contains('Place sandbox order').should('not.exist');
    cy.screenshot('guest-cart-quantity', { overwrite: true });
  });

  it('keeps seller and transaction routes authentication protected', () => {
    const gated = [
      '/marketplace/sell',
      '/marketplace/orders',
      '/marketplace/dashboard',
      '/marketplace/moderation',
      '/marketplace/offers',
      '/marketplace/messages',
      '/marketplace/settings',
      '/marketplace/notifications',
    ];
    gated.forEach((path) => {
      cy.visit(path);
      cy.location('pathname').should('not.eq', path);
    });
  });
});
