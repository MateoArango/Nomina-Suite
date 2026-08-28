import type { Locator, Page } from "@playwright/test";

type PageSize = 10 | 25 | 50 | 100;

export type PagerRange = {
  start: number;
  end: number;
  total: number;
};

export class LiquidationPeriodsPage {
  readonly heading: Locator;
  readonly loadingStatus: Locator;
  readonly periodTypeSelect: Locator;
  readonly newButton: Locator;
  readonly saveButton: Locator;
  readonly deleteButton: Locator;
  readonly table: Locator;
  readonly pager: Locator;
  readonly pagerSummary: Locator;
  readonly previousPageButton: Locator;
  readonly nextPageButton: Locator;

  constructor(readonly page: Page) {
    const routeHost = page.getByTestId("app-shell-route-host");

    this.heading = routeHost.getByText("Periodos de Liquidación", {
      exact: true,
    });
    this.loadingStatus = page.getByTestId("periodos-liq-loading-status");
    this.periodTypeSelect = page.locator(
      'mat-select[data-testid="periodos-liq-type-select"]',
    );
    this.newButton = page.locator(
      'button[data-testid="periodos-liq-actions-new-button"]',
    );
    this.saveButton = page.locator(
      'button[data-testid="periodos-liq-actions-save-button"]',
    );
    this.deleteButton = page.locator(
      'button[data-testid="periodos-liq-actions-delete-button"]',
    );
    this.table = routeHost.locator(
      'table[data-testid-pager-prefix="periodos-liq-table-pager"]',
    );
    this.previousPageButton = page.getByTestId(
      "periodos-liq-table-pager-previous-page-button",
    );
    this.nextPageButton = page.getByTestId(
      "periodos-liq-table-pager-next-page-button",
    );
    this.pager = this.previousPageButton.locator(
      'xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " erp-table-pager ")][1]',
    );
    this.pagerSummary = this.pager.locator(".erp-table-pager__summary");
  }

  row(periodId: string | number): Locator {
    return this.page.getByTestId(`periodos-liq-table-row--${periodId}`);
  }

  periodInput(periodId: string | number): Locator {
    return this.page
      .getByTestId(`periodos-liq-table-period-input--${periodId}`)
      .locator("input");
  }

  startDateInput(periodId: string | number): Locator {
    return this.page
      .getByTestId(`periodos-liq-table-start-date-input--${periodId}`)
      .locator("input");
  }

  endDateInput(periodId: string | number): Locator {
    return this.page
      .getByTestId(`periodos-liq-table-end-date-input--${periodId}`)
      .locator("input");
  }

  pageSizeButton(size: PageSize): Locator {
    return this.page.getByTestId(
      `periodos-liq-table-pager-page-size-button--${size}`,
    );
  }

  visibleRows(): Locator {
    return this.table.locator(
      'tbody tr[data-testid^="periodos-liq-table-row--"]:visible',
    );
  }

  emptyWorkingRow(): Locator {
    return this.table.locator("tbody tr:not([data-testid]):visible");
  }

  async readPagerRange(): Promise<PagerRange> {
    const summary = (await this.pagerSummary.textContent())?.trim() ?? "";
    const match = /^(\d+)-(\d+)\s+de\s+(\d+)$/.exec(summary);

    if (!match) {
      throw new Error(
        `Unexpected liquidation-periods pager summary: "${summary}"`,
      );
    }

    return {
      start: Number(match[1]),
      end: Number(match[2]),
      total: Number(match[3]),
    };
  }

  async selectedPageSize(): Promise<PageSize> {
    for (const size of [10, 25, 50, 100] as const) {
      if (
        (await this.pageSizeButton(size).getAttribute("aria-pressed")) ===
        "true"
      ) {
        return size;
      }
    }

    throw new Error("No liquidation-periods page size is selected");
  }
}
