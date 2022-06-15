describe('Test User Login', () => {


    it('Connects with Metamask', () => {
        cy.visit('http://localhost:3000')
        // find "Connect Account" button and click it
        cy.contains('Connect Account').click();
        // assuming there is only metamask popping up 
        // always important to switch between metamask and cypress window
        cy.switchToMetamaskWindow();
        // connect to dapp
        cy.acceptMetamaskAccess().should("be.true");
        // cy.confirmMetamaskSignatureRequest();
        // switch back to cypress window (your dApp)
        cy.switchToCypressWindow();
        // check UI change
    });

    it.skip("Deploy contract", () => {
        cy.visit('http://localhost:3000')
        cy.contains('Connect Wallet').click();
        cy.switchToMetamaskWindow();
        cy.acceptMetamaskAccess().should("be.true");
        cy.switchToCypressWindow();

        cy.get('#btnDeployContract').should('not.be.disabled').click();
        cy.confirmMetamaskSignatureRequest();
        // cy.waitUntil(() => cy.get('#btnDeployContract').should('not.be.disabled'))
    })
})