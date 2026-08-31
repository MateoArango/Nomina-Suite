// spec: specs/liquidation-periods-plan.md
// seed: tests/liquidationPeriods/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { LiquidationPeriodsPage } from "../../pages/LiquidationPeriods.page";

type LiquidationPeriodRecord = {
  kaNlPeriodo: number;
  scPeriodo: number;
  fechaInicial: string | null;
  fechaFinal: string | null;
};

const applicationUrl = "https://nomina-qa.adacsc.co/periodos-liq";
const newClickCount = 3;

function isRowsRequest(url: URL): boolean {
  return url.pathname.endsWith("/w-periodos-liq/rows");
}

function isMutationRequest(method: string, url: URL): boolean {
  return method !== "GET" && url.pathname.includes("/w-periodos-liq/");
}

function inputDate(value: string | null): string {
  return value?.slice(0, 10) ?? "";
}

async function visiblePersistedIds(
  liquidationPeriodsPage: LiquidationPeriodsPage,
): Promise<string[]> {
  const ids: string[] = [];

  for (const row of await liquidationPeriodsPage.visibleRows().all()) {
    const testId = await row.getAttribute("data-testid");

    expect(testId).not.toBeNull();
    ids.push(testId!.replace("periodos-liq-table-row--", ""));
  }

  return ids;
}

test.describe("Client-only row and selection behavior", () => {
  test("LP-004: New appends one selected empty working row without a request", async ({
    page,
  }) => {
    const liquidationPeriodsPage = new LiquidationPeriodsPage(page);
    const rowsRequests: string[] = [];
    const mutationRequests: string[] = [];

    page.on("request", request => {
      const url = new URL(request.url());

      if (request.method() === "GET" && isRowsRequest(url)) {
        rowsRequests.push(request.url());
      }

      if (isMutationRequest(request.method(), url)) {
        mutationRequests.push(request.url());
      }
    });

    await page.goto(applicationUrl);

    // 1. Select a runtime period type, record the baseline persisted IDs and network traffic, then click New once.
    const rowsResponsePromise = page.waitForResponse(response => {
      const url = new URL(response.url());

      return (
        response.request().method() === "GET" &&
        isRowsRequest(url) &&
        url.searchParams.get("tipoPeriodo") === "M"
      );
    });

    await liquidationPeriodsPage.periodTypeSelect.click();
    await page.getByTestId("periodos-liq-type-option-m").click();

    const rowsResponse = await rowsResponsePromise;
    const baselineRecords =
      (await rowsResponse.json()) as LiquidationPeriodRecord[];

    expect(rowsResponse.ok()).toBe(true);
    expect(Array.isArray(baselineRecords)).toBe(true);
    expect(rowsRequests).toHaveLength(1);
    expect(mutationRequests).toHaveLength(0);

    const baselinePager = await liquidationPeriodsPage.readPagerRange();
    const baselineVisibleCount = Math.min(
      baselineRecords.length,
      await liquidationPeriodsPage.selectedPageSize(),
    );
    const baselineVisibleRecords = baselineRecords.slice(
      0,
      baselineVisibleCount,
    );

    expect(baselinePager.total).toBe(baselineRecords.length);
    await expect(liquidationPeriodsPage.visibleRows()).toHaveCount(
      baselineVisibleCount,
    );
    await expect(liquidationPeriodsPage.emptyWorkingRow()).toHaveCount(0);

    await liquidationPeriodsPage.newButton.click();

    expect(rowsRequests).toHaveLength(1);
    expect(mutationRequests).toHaveLength(0);
    await expect(liquidationPeriodsPage.emptyWorkingRow()).toHaveCount(1);

    const workingRow = liquidationPeriodsPage.emptyWorkingRow();

    await expect(workingRow).toHaveClass(/\bselected\b/);
    await expect(workingRow.locator("input")).toHaveCount(3);

    for (const input of await workingRow.locator("input").all()) {
      await expect(input).toHaveValue("");
    }

    const currentPager = await liquidationPeriodsPage.readPagerRange();

    expect(currentPager.total).toBe(baselinePager.total + 1);
    await expect(liquidationPeriodsPage.saveButton).toBeEnabled();
    await expect(liquidationPeriodsPage.deleteButton).toBeEnabled();

    for (const record of baselineVisibleRecords) {
      const periodId = record.kaNlPeriodo;

      await expect(liquidationPeriodsPage.row(periodId)).toBeVisible();
      await expect(liquidationPeriodsPage.periodInput(periodId)).toHaveValue(
        String(record.scPeriodo),
      );
      await expect(
        liquidationPeriodsPage.startDateInput(periodId),
      ).toHaveValue(inputDate(record.fechaInicial));
      await expect(
        liquidationPeriodsPage.endDateInput(periodId),
      ).toHaveValue(inputDate(record.fechaFinal));
    }

    // 2. Reload the page without saving.
    await page.reload();

    await expect(liquidationPeriodsPage.periodTypeSelect).toHaveText("");
    await expect(liquidationPeriodsPage.visibleRows()).toHaveCount(0);
    await expect(liquidationPeriodsPage.emptyWorkingRow()).toHaveCount(0);
    await expect(liquidationPeriodsPage.pagerSummary).toHaveText(
      "Sin registros",
    );
    await expect(liquidationPeriodsPage.newButton).toBeDisabled();
    await expect(liquidationPeriodsPage.saveButton).toBeDisabled();
    await expect(liquidationPeriodsPage.deleteButton).toBeDisabled();

    expect(rowsRequests).toHaveLength(1);
    expect(mutationRequests).toHaveLength(0);
  });

  test("LP-005: Repeated New clicks append distinct client-only rows", async ({
    page,
  }) => {
    const liquidationPeriodsPage = new LiquidationPeriodsPage(page);
    const moduleRequests: string[] = [];
    const mutationRequests: string[] = [];

    page.on("request", request => {
      const url = new URL(request.url());

      if (url.pathname.includes("/w-periodos-liq/")) {
        moduleRequests.push(`${request.method()} ${request.url()}`);
      }

      if (isMutationRequest(request.method(), url)) {
        mutationRequests.push(`${request.method()} ${request.url()}`);
      }
    });

    await page.goto(applicationUrl);

    // 1. Load a type and click New multiple times, one completed action at a time.
    const rowsResponsePromise = page.waitForResponse(response => {
      const url = new URL(response.url());

      return (
        response.request().method() === "GET" &&
        isRowsRequest(url) &&
        url.searchParams.get("tipoPeriodo") === "M"
      );
    });

    await liquidationPeriodsPage.periodTypeSelect.click();
    await page.getByTestId("periodos-liq-type-option-m").click();

    const rowsResponse = await rowsResponsePromise;
    const baselineRecords =
      (await rowsResponse.json()) as LiquidationPeriodRecord[];

    expect(rowsResponse.ok()).toBe(true);
    expect(Array.isArray(baselineRecords)).toBe(true);

    await liquidationPeriodsPage.pageSizeButton(100).click();
    await expect(
      liquidationPeriodsPage.pageSizeButton(100),
    ).toHaveAttribute("aria-pressed", "true");

    expect(
      baselineRecords.length,
      "LP-005 needs room for all three working rows in the 100-row visible slice",
    ).toBeLessThanOrEqual(100 - newClickCount);

    const baselineIds = baselineRecords.map(record =>
      String(record.kaNlPeriodo),
    );
    const baselineVisibleIds =
      await visiblePersistedIds(liquidationPeriodsPage);
    const baselinePager = await liquidationPeriodsPage.readPagerRange();
    const baselineModuleRequestCount = moduleRequests.length;

    expect(baselinePager.total).toBe(baselineRecords.length);
    expect(baselineVisibleIds).toEqual(baselineIds);
    expect(mutationRequests).toHaveLength(0);
    await expect(liquidationPeriodsPage.emptyWorkingRow()).toHaveCount(0);

    for (
      let completedClicks = 1;
      completedClicks <= newClickCount;
      completedClicks += 1
    ) {
      await liquidationPeriodsPage.newButton.click();

      await expect(liquidationPeriodsPage.emptyWorkingRow()).toHaveCount(
        completedClicks,
      );

      for (const workingRow of await liquidationPeriodsPage
        .emptyWorkingRow()
        .all()) {
        await expect(workingRow).not.toHaveAttribute("data-testid");
        await expect(workingRow.locator("input")).toHaveCount(3);

        for (const input of await workingRow.locator("input").all()) {
          await expect(input).toHaveValue("");
        }
      }

      expect(await visiblePersistedIds(liquidationPeriodsPage)).toEqual(
        baselineVisibleIds,
      );
      expect(moduleRequests).toHaveLength(baselineModuleRequestCount);
      expect(mutationRequests).toHaveLength(0);

      const currentPager = await liquidationPeriodsPage.readPagerRange();

      expect(currentPager).toEqual({
        start: 1,
        end: baselineRecords.length + completedClicks,
        total: baselineRecords.length + completedClicks,
      });
      await expect(
        liquidationPeriodsPage.table.locator("tbody tr:visible"),
      ).toHaveCount(baselineRecords.length + completedClicks);
    }

    // 2. Reload without saving.
    await page.reload();

    await expect(liquidationPeriodsPage.periodTypeSelect).toHaveText("");
    await expect(liquidationPeriodsPage.visibleRows()).toHaveCount(0);
    await expect(liquidationPeriodsPage.emptyWorkingRow()).toHaveCount(0);
    await expect(liquidationPeriodsPage.pagerSummary).toHaveText(
      "Sin registros",
    );
    await expect(liquidationPeriodsPage.newButton).toBeDisabled();
    await expect(liquidationPeriodsPage.saveButton).toBeDisabled();
    await expect(liquidationPeriodsPage.deleteButton).toBeDisabled();

    expect(
      moduleRequests.filter(request => request.includes("/rows?")),
    ).toHaveLength(1);
    expect(mutationRequests).toHaveLength(0);
  });

  test("LP-006: Delete removes an unsaved selected row locally without a request", async ({
    page,
  }) => {
    const liquidationPeriodsPage = new LiquidationPeriodsPage(page);
    const mutationRequests: string[] = [];

    page.on("request", request => {
      const url = new URL(request.url());

      if (isMutationRequest(request.method(), url)) {
        mutationRequests.push(`${request.method()} ${request.url()}`);
      }
    });

    await page.goto(applicationUrl);

    // 1. Load a runtime period type and record the baseline persisted IDs, pager state, and module network traffic.
    const rowsResponsePromise = page.waitForResponse(response => {
      const url = new URL(response.url());

      return (
        response.request().method() === "GET" &&
        isRowsRequest(url) &&
        url.searchParams.get("tipoPeriodo") === "M"
      );
    });

    await liquidationPeriodsPage.periodTypeSelect.click();
    await page.getByTestId("periodos-liq-type-option-m").click();

    const rowsResponse = await rowsResponsePromise;
    const baselineRecords =
      (await rowsResponse.json()) as LiquidationPeriodRecord[];
    const baselineIds = await visiblePersistedIds(liquidationPeriodsPage);
    const baselinePager = await liquidationPeriodsPage.readPagerRange();
    const baselineVisibleCount =
      await liquidationPeriodsPage.visibleRows().count();

    expect(rowsResponse.ok()).toBe(true);
    expect(Array.isArray(baselineRecords)).toBe(true);
    expect(baselinePager.total).toBe(baselineRecords.length);
    expect(mutationRequests).toHaveLength(0);

    // 2. Click New once and verify exactly one selected ID-less empty row is added.
    await liquidationPeriodsPage.newButton.click();

    const workingRow = liquidationPeriodsPage.emptyWorkingRow();

    await expect(workingRow).toHaveCount(1);
    await expect(workingRow).toHaveClass(/\bselected\b/);
    await expect(workingRow.locator("input")).toHaveCount(3);

    for (const input of await workingRow.locator("input").all()) {
      await expect(input).toHaveValue("");
    }

    expect((await liquidationPeriodsPage.readPagerRange()).total).toBe(
      baselinePager.total + 1,
    );
    expect(mutationRequests).toHaveLength(0);

    // 3. Observe module mutation traffic, click Delete once, and confirm with Yes.
    const mutationObservation = page
      .waitForRequest(
        request => {
          const url = new URL(request.url());

          return isMutationRequest(request.method(), url);
        },
        { timeout: 1_000 },
      )
      .catch(() => null);

    await liquidationPeriodsPage.deleteButton.click();

    const confirmDeleteButton = page.getByTestId(
      "periodos-liq-dialog-delete-confirmation-confirm-button",
    );

    await expect(confirmDeleteButton).toBeVisible();
    await confirmDeleteButton.click();

    expect(await mutationObservation).toBeNull();
    expect(mutationRequests).toHaveLength(0);
    await expect(liquidationPeriodsPage.emptyWorkingRow()).toHaveCount(0);
    await expect(liquidationPeriodsPage.visibleRows()).toHaveCount(
      baselineVisibleCount,
    );
    expect(await visiblePersistedIds(liquidationPeriodsPage)).toEqual(
      baselineIds,
    );
    expect(await liquidationPeriodsPage.readPagerRange()).toEqual(
      baselinePager,
    );
  });

});
