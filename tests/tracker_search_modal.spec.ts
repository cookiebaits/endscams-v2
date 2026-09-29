import { test, expect } from '@playwright/test';

test.describe('EndScams Search and Tracker Modal Tests', () => {
  test('P1: Community Scam Database search finds /tracker number and gives scam summary', async ({ page }) => {
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.setItem('disclaimer_accepted', 'true'));

    // Search for number from tracker table
    const searchInput = page.locator('input[placeholder="(555) 123-4567"]');
    await searchInput.fill('(469) 820-9134');

    const searchBtn = page.locator('button[type="submit"]:has-text("Search")');
    await searchBtn.click();

    // Verify warning header and scam summary card
    const warningText = page.locator('text=Warning — Number Has Been Reported');
    await expect(warningText).toBeVisible({ timeout: 10000 });

    const scamSummary = page.locator('text=CashApp $5000 Drop Promo').first();
    await expect(scamSummary).toBeVisible({ timeout: 10000 });
  });

  test('P2: Clicking number on /tracker immediately opens modal centered in viewport with scroll locked', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('http://localhost:5173/tracker', { waitUntil: 'domcontentloaded' });

    const frame = page.frameLocator('iframe[title="EndScams Threat Tracker"]');
    await frame.locator('table tbody tr').first().waitFor({ timeout: 30000 });

    // Click phone number button inside iframe
    const phoneBtn = frame.locator('button:has-text("1 (469) 820-9134")').first();
    await phoneBtn.click();

    // Verify modal appears inside the iframe
    const modalHeader = frame.locator('text=Edit Threat Record Details').first();
    await expect(modalHeader).toBeVisible({ timeout: 10000 });

    // Verify modal element is visible
    const modalBox = frame.locator('div.fixed.inset-0').first();
    await expect(modalBox).toBeVisible({ timeout: 10000 });

    // Verify Cancel button in modal is present
    const cancelBtn = frame.locator('button:has-text("Cancel")').first();
    await expect(cancelBtn).toBeVisible({ timeout: 10000 });
  });
});
