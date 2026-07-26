import { test, expect } from '@playwright/test';
//const { test, expect } = require('@playwright/test');

test.describe.configure({ mode: 'parallel' });

const SIX_EVENTS_RESPONSE = {
  success: true,
  data: [
    { id: 1, title: 'Tech Summit 2025', category: 'Conference', eventDate: '2025-06-01T10:00:00.000Z', venue: 'HICC', city: 'Hyderabad', price: '999', totalSeats: 200, availableSeats: 150, imageUrl: null, isStatic: false },
    { id: 2, title: 'Rock Night Live',  category: 'Concert',    eventDate: '2025-06-05T18:00:00.000Z', venue: 'Palace Grounds', city: 'Bangalore', price: '1500', totalSeats: 500, availableSeats: 300, imageUrl: null, isStatic: false },
    { id: 3, title: 'IPL Finals',       category: 'Sports',     eventDate: '2025-06-10T19:30:00.000Z', venue: 'Chinnaswamy', city: 'Bangalore', price: '2000', totalSeats: 800, availableSeats: 50, imageUrl: null, isStatic: false },
    { id: 4, title: 'UX Design Workshop', category: 'Workshop', eventDate: '2025-06-15T09:00:00.000Z', venue: 'WeWork', city: 'Mumbai', price: '500', totalSeats: 50, availableSeats: 20, imageUrl: null, isStatic: false },
    { id: 5, title: 'Lollapalooza India', category: 'Festival', eventDate: '2025-06-20T12:00:00.000Z', venue: 'Mahalaxmi Racecourse', city: 'Mumbai', price: '3000', totalSeats: 5000, availableSeats: 2000, imageUrl: null, isStatic: false },
    { id: 6, title: 'AI & ML Expo',    category: 'Conference',  eventDate: '2025-06-25T10:00:00.000Z', venue: 'Bangalore International Exhibition Centre', city: 'Bangalore', price: '750', totalSeats: 300, availableSeats: 180, imageUrl: null, isStatic: false },
  ],
  pagination: { page: 1, totalPages: 1, total: 6, limit: 12 },
};

const FOUR_EVENTS_RESPONSE = {
  data: [
    { id: 1, title: 'Tech Summit 2025', category: 'Conference', eventDate: '2025-06-01T10:00:00.000Z', venue: 'HICC', city: 'Hyderabad', price: '999', totalSeats: 200, availableSeats: 150, imageUrl: null, isStatic: false },
    { id: 2, title: 'Rock Night Live',  category: 'Concert',    eventDate: '2025-06-05T18:00:00.000Z', venue: 'Palace Grounds', city: 'Bangalore', price: '1500', totalSeats: 500, availableSeats: 300, imageUrl: null, isStatic: false },
    { id: 3, title: 'IPL Finals',       category: 'Sports',     eventDate: '2025-06-10T19:30:00.000Z', venue: 'Chinnaswamy', city: 'Bangalore', price: '2000', totalSeats: 800, availableSeats: 50, imageUrl: null, isStatic: false },
    { id: 4, title: 'Sunil Personal Event', category: 'Workshop', eventDate: '2025-06-15T09:00:00.000Z', venue: 'WeWork', city: 'Mumbai', price: '500', totalSeats: 50, availableSeats: 20, imageUrl: null, isStatic: false },
  ],
  pagination: { page: 1, totalPages: 1, total: 4, limit: 12 },
};


test('Assignment Test', async ({ page }) => {
  await page.goto('https://eventhub.rahulshettyacademy.com');
 // await page.pause();
 await page.route("https://api.eventhub.rahulshettyacademy.com/api/events*", async route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FOUR_EVENTS_RESPONSE)
    });
  });

  page.route("https://api.eventhub.rahulshettyacademy.com/api/auth/login", async route => {
    route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({"success":false,"error":"Invalid email or password","details":[]})
    });
  });
  await page.getByPlaceholder('you@email.com').click();
  await page.getByPlaceholder('you@email.com').fill('sunil.test@example.com');
  await page.getByPlaceholder('you@email.com').press('Tab');
  await page.locator('#password').fill('Sunil@123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  //await expect(page).toHaveURL('https://eventhub.rahulshettyacademy.com/dashboard');
 // await page.pause();
});

//handling the popup and alert validations
test('Test options and popup validations',async ({page})=> {
  await page.goto('https://rahulshettyacademy.com/AutomationPractice/');
  await page.waitForLoadState('networkidle');
  await page.locator("#alertbtn").click();
  await page.on('dialog', async dialog => {
    console.log(`Dialog message: ${dialog.message()}`);
    await dialog.dismiss();
  })
 // await page.pause();
})
