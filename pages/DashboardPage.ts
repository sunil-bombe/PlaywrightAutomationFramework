import { Page, Locator } from '@playwright/test';

export class DashboardPage {
  private page: Page;
  private welcomeMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.welcomeMessage = this.page.locator("//li[@class='oxd-main-menu-item-wrapper'][3]"); // Update selector as needed
  }

  async isWelcomeMessageVisible(): Promise<boolean> {
    await this.page.waitForTimeout(3000); // Wait for 3 seconds
    console.log(await this.welcomeMessage.isVisible());
    return await this.welcomeMessage.isVisible();
  }
}