describe('marketplace', () => {
  it('browses the public catalog and filters sandbox inventory', () => {
    cy.visit('/marketplace');
    cy.contains('h1', 'Find something rare.').should('be.visible');
    cy.contains('Pubky Marketplace').should('be.visible');
    cy.get('input[placeholder="Search items, styles, or sellers"]').should('be.visible');

    cy.get('body').then(($body) => {
      if ($body.text().includes('Sandbox · no real funds')) {
        cy.contains('9 items').should('be.visible');
        cy.get('input[placeholder="Search items, styles, or sellers"]').type('camera');
        cy.contains('1 item').should('be.visible');
        cy.contains('35mm rangefinder camera').should('be.visible');
        cy.contains('Vintage leather boots').should('not.exist');
        cy.contains('button', 'Clear').click();
        cy.contains('9 items').should('be.visible');
      } else {
        cy.contains('Marketplace transactions are unavailable in this deployment.').should('be.visible');
      }
    });
  });

  it('shows a captioned listing gallery on a public sandbox item', () => {
    const seller = 'y'.repeat(52);
    cy.visit(`/marketplace/listing/${seller}/leather_boots`);
    cy.contains('h1', 'Vintage leather boots').should('be.visible');
    cy.contains('Vintage leather boots detail').should('be.visible');
    cy.contains('1 of 2').should('be.visible');
    cy.contains('button', 'Photo 2').click();
    cy.contains('2 of 2').should('be.visible');
  });

  it('shows Locks-protected digital delivery on a sandbox digital listing', () => {
    const seller = 'k'.repeat(52);
    cy.visit(`/marketplace/listing/${seller}/pattern_pack`);
    cy.contains('h1', 'Sewing pattern pack').should('be.visible');
    cy.contains('Locks-protected digital delivery').should('be.visible');
    cy.contains('Paykit sends the private Bitcoin request to Bitkit').should('be.visible');
  });

  it('keeps seller and transaction routes authentication protected', () => {
    cy.visit('/marketplace/sell');
    cy.location('pathname').should('not.eq', '/marketplace/sell');

    cy.visit('/marketplace/cart');
    cy.location('pathname').should('not.eq', '/marketplace/cart');
  });
});
