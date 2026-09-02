import { expect, test } from "../fixtures/auth.fixture";
import { MinimumWageHistoryPage } from "../../pages/MinimumWageHistory.page";

type MinimumWageHistoryRow = {
  vigencia: number;
};

const rowsPath = "/api/v1/w-mae-historico-salario-minimo/rows";

test("Seed Test", async ({ page }) => {
  const minimumWageHistoryPage = new MinimumWageHistoryPage(page);
  const rowsResponsePromise = page.waitForResponse(response => {
    const url = new URL(response.url());

    return url.pathname === rowsPath && response.request().method() === "GET";
  });

  await page.goto(
    "https://nomina-qa.adacsc.co/mae-historico-salario-minimo",
  );
  await expect(page).toHaveURL(/\/mae-historico-salario-minimo/);

  const rowsResponse = await rowsResponsePromise;
  expect(rowsResponse.ok()).toBe(true);

  const rows = (await rowsResponse.json()) as MinimumWageHistoryRow[];
  expect(Array.isArray(rows)).toBe(true);

  await expect(minimumWageHistoryPage.heading).toBeVisible();
  await expect(minimumWageHistoryPage.loadingStatus).toBeAttached();
  await expect(minimumWageHistoryPage.createButton).toBeEnabled();
  await expect(minimumWageHistoryPage.saveButton).toBeDisabled();
  await expect(minimumWageHistoryPage.undoButton).toBeDisabled();
  await expect(minimumWageHistoryPage.deleteButton).toBeDisabled();
  await expect(minimumWageHistoryPage.listTab).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(minimumWageHistoryPage.detailTab).toHaveAttribute(
    "aria-selected",
    "false",
  );
  await expect(minimumWageHistoryPage.table).toBeVisible();
  await expect(minimumWageHistoryPage.columnHeaders).toHaveCount(5);

  const selectedPageSize = await minimumWageHistoryPage.selectedPageSize();
  await expect(minimumWageHistoryPage.visibleRows()).toHaveCount(
    Math.min(selectedPageSize, rows.length),
  );

  const runtimeYears = new Set(rows.map(row => String(row.vigencia)));
  const visibleRows = await minimumWageHistoryPage.visibleRows().all();

  for (const row of visibleRows) {
    const testId = await row.getAttribute("data-testid");
    const year = testId?.split("--").at(-1);

    expect(year, `Missing year in row test id "${testId}"`).toBeDefined();
    expect(
      runtimeYears.has(year!),
      `Visible year ${year} was not returned by the rows endpoint`,
    ).toBe(true);
  }
});
