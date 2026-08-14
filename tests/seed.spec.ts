import { PriorizacionLiqConceptosPage } from "../pages/PriorizacionLiqConceptos.page";
import { expect, test } from "./fixtures/auth.fixture";

test.describe("Liquidation Concept Prioritization", () => {
  test("seed for liquidation concept prioritization", async ({ page }) => {
    const prioritizationPage = new PriorizacionLiqConceptosPage(page);

    await page.goto("https://nomina-qa.adacsc.co/priorizacion-conceptos");
    await expect(page).toHaveURL(/\/priorizacion-conceptos/);

    await expect(prioritizationPage.saveButton).toBeVisible();
    await expect(prioritizationPage.cancelButton).toBeVisible();
    await expect(prioritizationPage.assignButton).toBeVisible();
    await expect(prioritizationPage.removeButton).toBeVisible();
    await expect(prioritizationPage.moveUpButton).toBeVisible();
    await expect(prioritizationPage.moveDownButton).toBeVisible();
  });
});
