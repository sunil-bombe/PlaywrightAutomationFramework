import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import * as allure from "allure-js-commons";

test.beforeAll(async () => {
  console.log('Starting the test suite...');
  // allure.addEnvironment("Browser", "Chromium");
  // allure.addEnvironment("Base URL", "https://opensource-demo.orangehrmlive.com");
  
});

test.describe('Login Tests', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;

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
