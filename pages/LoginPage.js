class LoginPage {
  
    constructor(page) {
      this.page = page;
      this.usernameInput = page.locator("//input[@name='username']"); // Update selector as needed
      this.passwordInput = page.locator("//input[@name='password']"); // Update selector as needed
      this.loginButton = page.locator("//button[@type='submit']"); // Update selector as needed
    }
  
    async login(username, password) {
      await this.usernameInput.fill(username);
      await this.passwordInput.fill(password);
      await this.loginButton.click();
    }

    async navigate(url) {
      await this.page.goto(url);
    }

    async navigateToLoginPage() {
      await this.page.goto('https://opensource-demo.orangehrmlive.com/web/index.php/auth/login');
    }
  
    async enterUsername(username) {
      await this.usernameInput.fill(username);
    }
  
    async enterPassword(password) {
      await this.passwordInput.fill(password);
    }
  
    async clickLoginButton() {
      await this.loginButton.click();
    }
  
    async getCurrentUrl() {
      return this.page.url();
    }
    
  }

module.exports = { LoginPage };