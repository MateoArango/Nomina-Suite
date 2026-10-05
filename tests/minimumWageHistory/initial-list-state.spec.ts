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

  test("MWH-002: Column order and nullable numeric rendering remain stable", async ({
    page,
  }) => {
    const minimumWageHistoryPage = new MinimumWageHistoryPage(page);

    // 1. Load the runtime grid and inspect the table header.
    const rowsResponsePromise = page.waitForResponse(response => {
      const url = new URL(response.url());

      return (
        url.pathname === rowsPath && response.request().method() === "GET"
      );
    });

    await page.goto(
      "https://nomina-qa.adacsc.co/mae-historico-salario-minimo",
    );

    const rowsResponse = await rowsResponsePromise;
    expect(rowsResponse.ok()).toBe(true);

    const rows = (await rowsResponse.json()) as MinimumWageHistoryRow[];
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);

    await expect(minimumWageHistoryPage.columnHeaders).toHaveText([
      "Vigencia",
      "Salario Mínimo Gobierno",
      "Subsidio de Transporte",
      "Subsidio Alimentación",
      "IPC",
    ]);

    // 2. For every visible runtime row, compare ndSubsidioAlimentacion and ndIpc with their cells, including records containing null and numeric zero.
    const selectedPageSize =
      await minimumWageHistoryPage.selectedPageSize();
    const visibleRows = minimumWageHistoryPage.visibleRows();
    const expectedVisibleCount = Math.min(selectedPageSize, rows.length);

    await expect(visibleRows).toHaveCount(expectedVisibleCount);

    const pageLocale =
      (await page.locator("html").getAttribute("lang")) || "en-US";
    const numericFormatter = new Intl.NumberFormat(pageLocale, {
      maximumFractionDigits: 20,
    });
    const formatNullableNumeric = (value: number | null): string =>
      value === null ? "" : numericFormatter.format(value);

    let sawNull = false;
    let sawZero = false;

    for (const visibleRow of await visibleRows.all()) {
      const testId = await visibleRow.getAttribute("data-testid");
      const year = Number(testId?.split("--").at(-1));
      const runtimeRow = rows.find(row => row.vigencia === year);

      expect(
        runtimeRow,
        `Visible year ${year} was not returned by the rows endpoint`,
      ).toBeDefined();

      if (!runtimeRow) {
        throw new Error(
          `Visible year ${year} was not returned by the rows endpoint`,
        );
      }

      const cells = visibleRow.locator("td");
      const nullableValues = [
        runtimeRow.ndSubsidioAlimentacion,
        runtimeRow.ndIpc,
      ] as const;

      await expect(cells).toHaveCount(5);

      for (let index = 0; index < nullableValues.length; index += 1) {
        const runtimeValue = nullableValues[index];
        const cell = cells.nth(index + 3);

        sawNull ||= runtimeValue === null;
        sawZero ||= Object.is(runtimeValue, 0);

        await expect(cell).toHaveText(formatNullableNumeric(runtimeValue));

        const renderedValue = (await cell.textContent())?.trim() ?? "";
        expect(["undefined", "null", "NaN"]).not.toContain(renderedValue);
      }
    }

    expect(
      sawNull,
      "MWH-002 requires at least one visible runtime null value",
    ).toBe(true);
    expect(
      sawZero,
      "MWH-002 requires at least one visible runtime numeric zero",
    ).toBe(true);
  });
});
