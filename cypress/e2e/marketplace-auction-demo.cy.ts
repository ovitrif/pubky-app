describe('marketplace auction demo', () => {
  it('shows seeded auction status, vase policies, and shop policies', () => {
    const auctionSeller = 'n'.repeat(52);
    cy.visit(`/marketplace/listing/${auctionSeller}/rangefinder_camera`);
    cy.contains('h1', '35mm rangefinder camera').should('be.visible');
    cy.contains('Current bid').should('be.visible');
    cy.contains('h2', 'Auction status').should('be.visible').scrollIntoView();
    cy.contains('2 bids').should('be.visible');
    cy.contains('Reserve met').should('be.visible');
    cy.contains('Minimum next bid').should('be.visible');
    cy.contains('$80.01').should('be.visible');
    cy.contains('Sign in to see your standing').should('be.visible');
    cy.contains('h2', 'Bid history').should('be.visible').scrollIntoView();
    cy.contains('Bid 1').should('be.visible');
    cy.contains('Bid 2').should('be.visible');
    cy.contains('No bids yet').should('not.exist');
    cy.contains('maximumAmount').should('not.exist');
    cy.contains('h2', 'Buying policies').should('be.visible').scrollIntoView();
    cy.wait(1500);

    const vaseSeller = 'd'.repeat(52);
    cy.visit(`/marketplace/listing/${vaseSeller}/ceramic_vase`);
    cy.contains('h1', 'Hand-thrown ceramic vase').should('be.visible');
    cy.contains('Seller is on vacation').should('be.visible');
    cy.contains('Seller auto-accepts offers at or above $60.00').should('be.visible');
    cy.contains('h2', 'Buying policies').should('be.visible');
    cy.wait(1500);

    const shopSeller = 'y'.repeat(52);
    cy.visit(`/marketplace/shop/${shopSeller}`);
    cy.contains('h1', 'Satoshi Vintage').should('be.visible');
    cy.contains('h2', 'Buying policies').should('be.visible');
    cy.contains('Sandbox guarantee policy v1').should('be.visible');
    cy.wait(1500);
  });
});
