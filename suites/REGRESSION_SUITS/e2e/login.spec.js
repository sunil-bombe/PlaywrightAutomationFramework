
const { test, expect } = require('@playwright/test');
const LoginPage = require('../pages/LoginPage');
const DashboardPage = require('../pages/DashboardPage');
import { allure } from 'allure-playwright';

test.describe('Login Tests', () => {
  let loginPage;
  let dashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);

    // Navigate to the login page
    await loginPage.navigate('https://opensource-demo.orangehrmlive.com');
  });

  test('Should log in with valid credentials', async ({ page }) => {

    // Perform login
    await loginPage.login('Admin', 'admin123');
    // Verify successful login
    const isWelcomeVisible = await dashboardPage.isWelcomeMessageVisible();
    expect(isWelcomeVisible).toBe(true);
  });

  test('Should log in with valid credential  2', async ({ page }) => {
    // Perform login
    await loginPage.login('Admin', 'admin123');
    // Verify successful login
    const isWelcomeVisible = await dashboardPage.isWelcomeMessageVisible();
    expect(isWelcomeVisible).toBe(true);
  });
});
