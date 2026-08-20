describe('marketplace signed-in', { video: false }, () => {
  it('restores the staging session and opens seller tools', () => {
    cy.task<string | null>('getStagingRecoveryPhrase').then((phrase) => {
      expect(phrase, 'STAGING_RECOVERY_PHRASE must be a 12-word staging phrase').to.be.a('string');
      cy.signInWithRecoveryPhrase(phrase as string);

      cy.visit('/marketplace/cart');
      cy.location('pathname').should('eq', '/marketplace/cart');
      cy.contains('h1', 'Cart').should('be.visible');
      cy.screenshot('signed-in-cart', { overwrite: true });

      cy.visit('/marketplace/sell');
      cy.location('pathname').should('eq', '/marketplace/sell');
      cy.contains('h1', 'Create a listing').should('be.visible');
      cy.screenshot('signed-in-sell', { overwrite: true });

      cy.visit('/marketplace/dashboard');
      cy.location('pathname').should('eq', '/marketplace/dashboard');
      cy.contains('h1', 'Seller dashboard').should('be.visible');
      cy.screenshot('signed-in-dashboard', { overwrite: true });

      cy.visit('/marketplace/orders');
      cy.location('pathname').should('eq', '/marketplace/orders');
      cy.contains('h1', 'Orders').should('be.visible');
      cy.screenshot('signed-in-orders', { overwrite: true });

      const seller = 'y'.repeat(52);
      cy.visit(`/marketplace/listing/${seller}/leather_boots`);
      cy.contains('h1', 'Vintage leather boots').should('be.visible');
      cy.contains('button', 'Add to cart').click();
      cy.contains('Added to cart').should('be.visible');
      cy.visit('/marketplace/cart');
      cy.contains('Vintage leather boots').should('be.visible');
      cy.contains('Delivery and guarantee').should('be.visible');
      cy.contains('Place sandbox order').should('be.visible');
      cy.contains('Sign in to check out').should('not.exist');
      cy.screenshot('signed-in-cart-checkout', { overwrite: true });
    });
  });
});
