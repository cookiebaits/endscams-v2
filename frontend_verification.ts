import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:5173');
  await page.evaluate(() => {
    localStorage.setItem('disclaimer_accepted', 'true');
  });
  await page.reload();

  await page.waitForLoadState('networkidle');
  // Wait for count-up animation to finish (duration is 2000ms)
  await page.waitForTimeout(2500);

  await page.screenshot({ path: '/home/jules/verification/homepage-stats-verification-2.png', fullPage: true });

  await browser.close();
})();
