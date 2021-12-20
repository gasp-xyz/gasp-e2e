describe("Mangata Finance Subscriptions", () => {
  const serverId = 'wcuadbsp';
  const randomNumber = Math.floor(Math.random() * 1000000).toString();
  const testEmail = "mangata-test+" + randomNumber + "@wcuadbsp.mailosaur.net";

  it("User can subscribe", () => {
    cy.visit("https://mangata.finance/");
    cy.get('input[name="email"]').type(testEmail);
    cy.contains("Subscribe").click();
  });

  it("User receives subscription email", () => {
    cy.mailosaurGetMessage(serverId, {
      sentTo: testEmail
    }).then(email => {
      expect(email.subject).to.equal('Mangata Finance: Please Confirm Subscription');
      subscriptionLink = email.text.links[0].href;
    })
  })

  it('User can confirm subscription from link in the email', () => {
    cy.visit(subscriptionLink);
    cy.contains('Subscription Confirmed');
  })

  it('User can continue to Mangata after confirming subscription', () => {
    cy.visit(subscriptionLink);
    cy.contains('continue to our website').click();
    expect(cy.url()).to.equal('https://mangata.finance');
  })
});
