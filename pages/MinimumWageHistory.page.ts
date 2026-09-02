import type { Locator, Page } from "@playwright/test";

type PageSize = 10 | 25 | 50 | 100;

export type PagerRange = {
  start: number;
  end: number;
  total: number;
};

export class MinimumWageHistoryPage {
  readonly routeHost: Locator;
  readonly heading: Locator;
  readonly toolbar: Locator;
  readonly loadingStatus: Locator;
  readonly createButton: Locator;
  readonly saveButton: Locator;
  readonly undoButton: Locator;
  readonly deleteButton: Locator;
  readonly listTab: Locator;
  readonly detailTab: Locator;
  readonly table: Locator;
  readonly columnHeaders: Locator;
  readonly pager: Locator;
  readonly pagerSummary: Locator;
  readonly previousPageButton: Locator;
  readonly nextPageButton: Locator;
  readonly detailYearValue: Locator;
  readonly detailGovernmentMinimumWageValue: Locator;
  readonly detailTransportationSubsidyValue: Locator;
  readonly detailFoodSubsidyValue: Locator;
  readonly detailFoodSubsidyInput: Locator;
  readonly detailIpcValue: Locator;

  constructor(readonly page: Page) {
    this.routeHost = page.getByTestId("app-shell-route-host");
    this.loadingStatus = page.getByTestId(
      "mae-historico-salario-minimo-loading-status",
    );
    this.createButton = page.getByTestId(
      "mae-historico-salario-minimo-topbar-new-button",
    );
    this.toolbar = this.createButton.locator("xpath=ancestor::bds-top-bar");
    this.heading = this.toolbar.locator(".title");
    this.saveButton = page.getByTestId(
      "mae-historico-salario-minimo-topbar-save-button",
    );
    this.undoButton = page.getByTestId(
      "mae-historico-salario-minimo-topbar-undo-button",
    );
    this.deleteButton = page.getByTestId(
      "mae-historico-salario-minimo-topbar-delete-button",
    );
    this.listTab = page.getByTestId(
      "mae-historico-salario-minimo-tabs-list-button",
    );
    this.detailTab = page.getByTestId(
      "mae-historico-salario-minimo-tabs-detail-button",
    );
    this.table = this.routeHost.locator(
      'table[data-testid-pager-prefix="mae-historico-salario-minimo-list-table-pager"]',
    );
    this.columnHeaders = this.table.locator("thead th");
    this.previousPageButton = page.getByTestId(
      "mae-historico-salario-minimo-list-table-pager-previous-page-button",
    );
    this.nextPageButton = page.getByTestId(
      "mae-historico-salario-minimo-list-table-pager-next-page-button",
    );
    this.pager = this.previousPageButton.locator(
      'xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " erp-table-pager ")][1]',
    );
    this.pagerSummary = this.pager.locator(".erp-table-pager__summary");
    this.detailYearValue = this.detailTextValue("Vigencia:");
    this.detailGovernmentMinimumWageValue = this.detailTextValue(
      "Salario mínimo gobierno:",
    );
    this.detailTransportationSubsidyValue = this.detailTextValue(
      "Subsidio de transporte:",
    );
    this.detailFoodSubsidyValue = this.detailTextValue(
      "Subsidio alimentación:",
    );
    this.detailFoodSubsidyInput = page.getByTestId(
      "mae-historico-salario-minimo-form-food-subsidy-input",
    );
    this.detailIpcValue = this.detailTextValue("IPC:");
  }

  private detailTextValue(label: string): Locator {
    return this.routeHost
      .locator(".field-pair")
      .filter({ has: this.page.getByText(label, { exact: true }) })
      .locator("strong");
  }

  row(year: string | number): Locator {
    return this.page.getByTestId(
      `mae-historico-salario-minimo-list-table-row--${year}`,
    );
  }

  visibleRows(): Locator {
    return this.table.locator(
      'tbody tr[data-testid^="mae-historico-salario-minimo-list-table-row--"]:visible',
    );
  }

  pageSizeButton(size: PageSize): Locator {
    return this.page.getByTestId(
      `mae-historico-salario-minimo-list-table-pager-page-size-button--${size}`,
    );
  }

  async readPagerRange(): Promise<PagerRange> {
    const summary = (await this.pagerSummary.textContent())?.trim() ?? "";
    const match = /^(\d+)-(\d+)\s+de\s+(\d+)$/.exec(summary);

    if (!match) {
      throw new Error(
        `Unexpected minimum-wage-history pager summary: "${summary}"`,
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

    throw new Error("No minimum-wage-history page size is selected");
  }
}
