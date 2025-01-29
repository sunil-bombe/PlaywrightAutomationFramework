class LoginPage {
    constructor(page) {
      this.page = page;
      this.usernameInput = page.locator("//input[@name='username']"); // Update selector as needed
      this.passwordInput = page.locator("//input[@name='password']"); // Update selector as needed
      this.loginButton = page.locator("//button[@type='submit']"); // Update selector as needed
    }
  
    async navigate(url) {
      await this.page.goto(url);
    }
  
    async login(username, password) {
      await this.usernameInput.fill(username);
      await this.passwordInput.fill(password);
      await this.loginButton.click();
    }
  }
  
  module.exports = LoginPage;
  