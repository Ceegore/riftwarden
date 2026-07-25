import { expect, test } from '@playwright/test';

const locales = ['de','en','qps-ploc'] as const;
const viewports = [
  { name:'phone-compact', width:320, height:568 },
  { name:'phone-standard', width:390, height:844 },
  { name:'tablet', width:1024, height:1366 },
] as const;
const states = ['bootstrap','bootstrap-long-wait','recovery','compatibility','resume','fatal'] as const;

for (const locale of locales) {
  for (const viewport of viewports) {
    for (const state of states) {
      test(`${locale}/${viewport.name}/${state}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(`/?fixture=phase06-system-shell&state=${state}&locale=${locale}&textScale=1`);
        await expect(page.getByTestId('locale-fixture-root')).toHaveAttribute('data-ready', 'true');
        await expect(page.getByTestId('locale-fixture-root')).toHaveScreenshot(`${locale}-${viewport.name}-${state}.png`, { animations:'disabled' });
        await expect(page.locator('[data-overflow="true"]')).toHaveCount(0);
      });
    }
  }
}

test('critical system shells at 200 percent text', async ({ page }) => {
  await page.setViewportSize({ width:320, height:568 });
  for (const locale of locales) {
    for (const state of ['recovery','compatibility','resume','fatal'] as const) {
      await page.goto(`/?fixture=phase06-system-shell&state=${state}&locale=${locale}&textScale=2&reduceMotion=1`);
      await expect(page.locator('[data-overflow="true"]')).toHaveCount(0);
      await expect(page.getByTestId('locale-fixture-root')).toHaveScreenshot(`${locale}-phone-compact-${state}-200pct.png`, { animations:'disabled' });
    }
  }
});
