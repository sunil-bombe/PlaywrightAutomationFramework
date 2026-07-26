import { test, expect, chromium } from '@playwright/test';

test('start testing on flipkart', async ({ page }) => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page1 = await context.newPage();
  // Navigate to Flipkart
  await page1.goto('https://eventhub.rahulshettyacademy.com');
});