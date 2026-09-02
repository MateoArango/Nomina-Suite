// spec: specs/minimum-wage-history-plan.md
// seed: tests/minimumWageHistory/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { MinimumWageHistoryPage } from "../../pages/MinimumWageHistory.page";

type MinimumWageHistoryRow = {
  vigencia: number;
  ndSalarioMinimoGob: number;
  ndSubsidioMes: number;
  ndSubsidioAlimentacion: number | null;
  ndIpc: number | null;
};

const rowsPath = "/api/v1/w-mae-historico-salario-minimo/rows";

test.describe("Runtime list view and pagination", () => {
  test("MWH-001: Initial list state maps every visible row to the runtime rows response", async ({
    page,
  }) => {
    const minimumWageHistoryPage = new MinimumWageHistoryPage(page);

    // 1. From a fresh authenticated page, start waiting for GET /api/v1/w-mae-historico-salario-minimo/rows and navigate to /mae-historico-salario-minimo.
    const rowsResponsePromise = page.waitForResponse(response => {
      const url = new URL(response.url());

      return (
        url.pathname === rowsPath && response.request().method() === "GET"
      );
    });

    await page.goto(
      "https://nomina-qa.adacsc.co/mae-historico-salario-minimo",
    );
    await expect(page).toHaveURL(/\/mae-historico-salario-minimo/);

    const rowsResponse = await rowsResponsePromise;
    expect(rowsResponse.ok()).toBe(true);

    const rows = (await rowsResponse.json()) as MinimumWageHistoryRow[];
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    expect(
      rows.every(
        row =>
          typeof row.vigencia === "number" && Number.isFinite(row.vigencia),
      ),
    ).toBe(true);
    expect(new Set(rows.map(row => row.vigencia)).size).toBe(rows.length);

    await expect(minimumWageHistoryPage.listTab).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(minimumWageHistoryPage.detailTab).toHaveAttribute(
      "aria-selected",
      "false",
    );
    await expect(minimumWageHistoryPage.createButton).toBeEnabled();
    await expect(minimumWageHistoryPage.saveButton).toBeDisabled();
    await expect(minimumWageHistoryPage.undoButton).toBeDisabled();
    await expect(minimumWageHistoryPage.deleteButton).toBeDisabled();

    // 2. Read the selected page size, pager range, visible row test IDs, and each visible row's five cells.
    const selectedPageSize =
      await minimumWageHistoryPage.selectedPageSize();
    const pagerRange = await minimumWageHistoryPage.readPagerRange();
    const expectedVisibleCount = Math.min(selectedPageSize, rows.length);
    const visibleRows = minimumWageHistoryPage.visibleRows();

    expect(pagerRange).toEqual({
      start: 1,
      end: expectedVisibleCount,
      total: rows.length,
    });
    await expect(visibleRows).toHaveCount(expectedVisibleCount);

    const pageLocale =
      (await page.locator("html").getAttribute("lang")) || "en-US";
    const numericFormatter = new Intl.NumberFormat(pageLocale, {
      maximumFractionDigits: 20,
    });
    const formatNumeric = (value: number | null): string =>
      value === null ? "" : numericFormatter.format(value);

    for (let index = 0; index < expectedVisibleCount; index += 1) {
      const runtimeRow = rows[index];
      const visibleRow = visibleRows.nth(index);
      const cells = visibleRow.locator("td");

      await expect(visibleRow).toHaveAttribute(
        "data-testid",
        `mae-historico-salario-minimo-list-table-row--${runtimeRow.vigencia}`,
      );
      await expect(cells).toHaveCount(5);
      await expect(cells).toHaveText([
        String(runtimeRow.vigencia),
        formatNumeric(runtimeRow.ndSalarioMinimoGob),
        formatNumeric(runtimeRow.ndSubsidioMes),
        formatNumeric(runtimeRow.ndSubsidioAlimentacion),
        formatNumeric(runtimeRow.ndIpc),
      ]);
    }
  });
});
