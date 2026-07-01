const { Given, When, Then, Before, After } = require('@cucumber/cucumber');
const { chromium, expect } = require('@playwright/test');


Given('I am on the OrangeHRM login page',{
    timeout: 60 * 1000
}, async function () {
  await this.poManager.getLoginPage().navigateToLoginPage();
});

When('I enter valid username and password', async function () {
  await this.poManager.getLoginPage().enterUsername('Admin');
  await this.poManager.getLoginPage().enterPassword('admin123');
});

When('I click the login button', async function () {
  await this.poManager.getLoginPage().clickLoginButton();
});

Then('I should be redirected to the dashboard page', async function () {
  const currentUrl = await this.poManager.getDashboardPage().getCurrentUrl();
  expect(currentUrl).toContain('/dashboard');
}); 