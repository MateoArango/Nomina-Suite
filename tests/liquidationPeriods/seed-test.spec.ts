import { expect, test } from "../fixtures/auth.fixture";
import { LiquidationPeriodsPage } from "../../pages/LiquidationPeriods.page";

test("Seed Test", async ({ page }) => {
  const liquidationPeriodsPage = new LiquidationPeriodsPage(page);

  await page.goto("https://nomina-qa.adacsc.co/periodos-liq");

  await expect(liquidationPeriodsPage.heading).toBeVisible();
  await expect(liquidationPeriodsPage.loadingStatus).toBeAttached();
  await expect(liquidationPeriodsPage.periodTypeSelect).toBeVisible();
  await expect(liquidationPeriodsPage.newButton).toBeDisabled();
  await expect(liquidationPeriodsPage.saveButton).toBeDisabled();
  await expect(liquidationPeriodsPage.deleteButton).toBeDisabled();
  await expect(liquidationPeriodsPage.table).toBeVisible();
  await expect(liquidationPeriodsPage.pager).toBeVisible();
  await expect(liquidationPeriodsPage.previousPageButton).toBeDisabled();
  await expect(liquidationPeriodsPage.nextPageButton).toBeDisabled();

  for (const size of [10, 25, 50, 100] as const) {
    await expect(liquidationPeriodsPage.pageSizeButton(size)).toBeVisible();
  }

  await expect(liquidationPeriodsPage.visibleRows()).toHaveCount(0);
});
