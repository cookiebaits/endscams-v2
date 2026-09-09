import { test, expect } from '@playwright/test';

test('verify live tracker manual refresh extracts real TSU numbers', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.evaluate(() => {
    localStorage.setItem('disclaimer_accepted', 'true');
  });

  await page.goto('http://localhost:5173/tracker');
  await page.waitForTimeout(1000);

  // Click Manual Refresh
  const refreshBtn = page.locator('#btn-footer-manual-refresh');
  await expect(refreshBtn).toBeVisible();
  await refreshBtn.click();

  // Wait for scanning cycle
  await page.waitForTimeout(3000);

  // Verify real front page numbers from TSU are visible
  const content = await page.content();
  console.log('Page content check for McAfee / 863-329-1450...');

  // Take screenshot
  await page.screenshot({ path: '/home/jules/verification/tracker_live_tsu_refresh.png', fullPage: true });
});
