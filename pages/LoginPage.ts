import { Page, Locator } from '@playwright/test';
export class LoginPage {
  private page: Page;
  private usernameInput: Locator;
  private passwordInput: Locator;
  private loginButton: Locator;

    constructor(page: Page) {
      this.page = page;
      this.usernameInput = page.locator("//input[@name='username']"); // Update selector as needed
      this.passwordInput = page.locator("//input[@name='password']"); // Update selector as needed
      this.loginButton = page.locator("//button[@type='submit']"); // Update selector as needed
    }
  
    async navigate(url:string) {
      await this.page.goto(url);
    }
  
    async login(username: string, password: string) {
      await this.usernameInput.fill(username);
      await this.passwordInput.fill(password);
      await this.loginButton.click();
    }
  }