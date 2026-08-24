import { expect, test } from "../fixtures/auth.fixture";
import { AdministrativeUpdateConceptsPage } from "../../pages/AdministrativeUpdateConcepts.page";

test("Seed Test", async ({ page }) => {
  const conceptsPage = new AdministrativeUpdateConceptsPage(page);

  await page.goto("https://nomina-qa.adacsc.co/conceptos-nov-ad");

  await expect(conceptsPage.heading).toBeVisible();
  await expect(conceptsPage.toolbar).toBeVisible();
  await expect(conceptsPage.loadingStatus).toBeAttached();
  await expect(conceptsPage.table).toBeVisible();
  await expect(conceptsPage.pager).toBeVisible();
  await expect(conceptsPage.reloadButton).toBeEnabled();
  await expect(conceptsPage.deleteButton).toBeDisabled();
  await expect(conceptsPage.saveButton).toBeDisabled();
  await expect(conceptsPage.previousPageButton).toBeDisabled();

  for (const size of [10, 25, 50, 100] as const) {
    await expect(conceptsPage.pageSizeButton(size)).toBeVisible();
  }

  await expect(conceptsPage.visibleRows()).not.toHaveCount(0);

  const firstRowTestId = await conceptsPage
    .visibleRows()
    .first()
    .getAttribute("data-testid");
  const rowKey = firstRowTestId?.split("--").at(-1);

  if (!rowKey) {
    throw new Error(`Unexpected row test ID: "${firstRowTestId}"`);
  }

  await expect(conceptsPage.row(rowKey)).toBeVisible();
  await expect(conceptsPage.noveltySelect(rowKey)).toBeVisible();
  await expect(conceptsPage.actionsCell(rowKey)).toBeVisible();
  await expect(conceptsPage.conceptPickerButton(rowKey)).toBeVisible();
});
