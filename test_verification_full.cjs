const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('http://localhost:5173/tracker');
  await page.evaluate(() => localStorage.setItem('disclaimer_accepted', 'true'));
  await page.reload();
  await page.waitForTimeout(1000);

  // Take screenshot of tracker
  await page.screenshot({ path: 'tracker_before_refresh.png' });

  // Click Manual Refresh
  const refreshBtn = page.locator('button:has-text("Manual Refresh")');
  await refreshBtn.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tracker_after_refresh.png' });

  // Click Report Scam (endscams.org)
  const reportBtn = page.locator('button:has-text("Report Scam (endscams.org)")');
  await reportBtn.click();
  await page.waitForTimeout(1500);
  console.log('Current URL after click:', page.url());
  await page.screenshot({ path: 'report_page_nav.png' });

  await browser.close();
})();
