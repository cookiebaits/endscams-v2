import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:5173');
  await page.evaluate(() => localStorage.setItem('disclaimer_accepted', 'true'));

  await page.goto('http://localhost:5173/report');
  await page.fill('input[placeholder*="e.g."]', '8583085344');
  await page.selectOption('select', 'Lottery / Prize Scam');
  await page.fill('textarea', 'xyz said they were from PCH and requested advance payment for lottery fees');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1000);

  await page.goto('http://localhost:5173/tracker');
  await page.waitForTimeout(3000);

  const frame = page.frameLocator('iframe[title="Scam Tracker"]');
  await frame.locator('input[placeholder*="Search by phone"]').fill('8583085344');
  await page.waitForTimeout(1000);

  await page.screenshot({ path: '/home/jules/verification/tracker_table_pch.png', fullPage: true });

  await browser.close();
})();
