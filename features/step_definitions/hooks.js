const { Before, After , AfterStep, BeforeStep} = require('@cucumber/cucumber');
const { chromium } = require('@playwright/test');
const { POManager } = require('../../pages/POManager');

Before(async function () {
    this.browser = await chromium.launch({ headless: false });
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();
    this.poManager = new POManager(this.page);
});

BeforeStep(async function ({result, pickle, scenario}) {
   // console.log(`Before Step: ${scenario.name} - ${pickle.name}`);
});

After(async function () {
    if (this.page) await this.page.close();
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
});

AfterStep(async function ({ result, pickle, scenario }) {
    if (result.status === 'FAILED') {
        const screenshot = await this.page.screenshot({ path: `screenshots/${scenario.name}.png` });
        this.attach(screenshot, 'image/png');
    }
});

