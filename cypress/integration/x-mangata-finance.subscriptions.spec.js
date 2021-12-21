describe("X Mangata Finance Subscriptions", () => {
    const randomNumber = Math.floor(Math.random() * 1000000).toString();
    const testEmail = "mangata-test+" + randomNumber + "@wcuadbsp.mailosaur.net";

    it("User can subscribe", () => {
    cy.visit("https://x.mangata.finance/");
        cy.get('input[name="email"]').type(testEmail);
        cy.contains("Join Waiting List").click();
        cy.contains('Thank you! Your submission has been received!').should("be.visible");
    });
});
