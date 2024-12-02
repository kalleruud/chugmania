import { expect, test } from '@playwright/test';

test('Show login screen when not logged in', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('login-form')).toBeVisible();
});
