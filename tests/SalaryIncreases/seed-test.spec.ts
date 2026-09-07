import { expect, test } from "../fixtures/auth.fixture";
import { SalaryIncreasesPage } from "../../pages/SalaryIncreases.page";

test.describe("Salary Increases", () => {
  test("Seed Test", async ({ page }) => {
    const salaryIncreasesPage = new SalaryIncreasesPage(page);

    // 1. Sign in through the authentication fixture and open Salary Increases.
    await salaryIncreasesPage.goto();

    // 2. Verify the page and its default filter tab.
    await expect(page).toHaveURL("https://nomina-qa.adacsc.co/aumento-sueldo");
    await expect(salaryIncreasesPage.toolbar).toBeVisible();
    await expect(salaryIncreasesPage.filterTab).toHaveAttribute("aria-selected", "true");
    await expect(salaryIncreasesPage.increasesTab).toHaveAttribute("aria-selected", "false");

    // 3. Verify the main filter controls and wait for the actions to become ready.
    await expect(salaryIncreasesPage.employeeTypeSelect).toBeVisible();
    await expect(salaryIncreasesPage.positionOpenButton).toBeVisible();
    await expect(salaryIncreasesPage.sectionOpenButton).toBeVisible();
    await expect(salaryIncreasesPage.startDateInput).toBeVisible();
    await expect(salaryIncreasesPage.percentageInput).toBeVisible();
    await expect(salaryIncreasesPage.resetFiltersButton).toBeEnabled();
    await expect(salaryIncreasesPage.calculateButton).toBeEnabled();
  });
});
