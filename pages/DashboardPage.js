class DashboardPage {

    constructor(page) {
      this.page = page;
      this.welcomeMessage = page.locator("//li[@class='oxd-main-menu-item-wrapper'][3]"); // Update selector as needed
    }
  
    async isWelcomeMessageVisible() {
    await this.page.waitForTimeout(3000); // Wait for 3 seconds
    console.log(await this.welcomeMessage.isVisible());
    return await this.welcomeMessage.isVisible();
    }

     async getCurrentUrl() {
      return this.page.url();
    }
  }
  
  module.exports = {DashboardPage};