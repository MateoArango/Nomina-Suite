import type { Locator, Page } from "@playwright/test";

type PageSize = 10 | 25 | 50 | 100;

export type AdministrativeConceptRowKey =
  | string
  | {
      conceptId: string | number;
      noveltyCode: string;
    };

export type PagerRange = {
  start: number;
  end: number;
  total: number;
};

export class AdministrativeUpdateConceptsPage {
  readonly heading: Locator;
  readonly toolbar: Locator;
  readonly loadingStatus: Locator;
  readonly reloadButton: Locator;
  readonly deleteButton: Locator;
  readonly saveButton: Locator;
  readonly table: Locator;
  readonly pager: Locator;
  readonly pagerSummary: Locator;
  readonly previousPageButton: Locator;
  readonly nextPageButton: Locator;
  readonly conceptPickerPanel: Locator;
  readonly conceptPickerCloseButton: Locator;
  readonly conceptPickerBackdrop: Locator;

  constructor(readonly page: Page) {
    const routeHost = page.getByTestId("app-shell-route-host");

    this.heading = routeHost.getByText("Conceptos novedades administrativas", {
      exact: true,
    });
    this.loadingStatus = page.getByTestId("conceptos-nov-ad-loading-status");
    this.reloadButton = page.getByTestId(
      "conceptos-nov-ad-actions-reload-button",
    );
    this.toolbar = this.reloadButton.locator("xpath=ancestor::bds-top-bar");
    this.deleteButton = page.getByTestId(
      "conceptos-nov-ad-actions-delete-button",
    );
    this.saveButton = page.getByTestId(
      "conceptos-nov-ad-actions-save-button",
    );
    this.table = routeHost.locator(
      'table[data-testid-pager-prefix="conceptos-nov-ad-table-pager"]',
    );
    this.previousPageButton = page.getByTestId(
      "conceptos-nov-ad-table-pager-previous-page-button",
    );
    this.nextPageButton = page.getByTestId(
      "conceptos-nov-ad-table-pager-next-page-button",
    );
    this.pager = this.previousPageButton.locator(
      'xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " erp-table-pager ")][1]',
    );
    this.pagerSummary = this.pager.locator(".erp-table-pager__summary");
    this.conceptPickerPanel = page.getByTestId(
      "conceptos-nov-ad-concept-picker-panel",
    );
    this.conceptPickerCloseButton = page.getByTestId(
      "conceptos-nov-ad-concept-picker-close-button",
    );
    this.conceptPickerBackdrop = page.getByTestId(
      "conceptos-nov-ad-concept-picker-backdrop",
    );
  }

  row(rowKey: AdministrativeConceptRowKey): Locator {
    return this.page.getByTestId(
      `conceptos-nov-ad-table-row--${this.resolveRowKey(rowKey)}`,
    );
  }

  noveltySelect(rowKey: AdministrativeConceptRowKey): Locator {
    const testId = `conceptos-nov-ad-table-novelty-select-row--${this.resolveRowKey(rowKey)}`;

    return this.page.locator(`mat-select[data-testid="${testId}"]`);
  }

  actionsCell(rowKey: AdministrativeConceptRowKey): Locator {
    return this.page.getByTestId(
      `conceptos-nov-ad-table-actions-cell-row--${this.resolveRowKey(rowKey)}`,
    );
  }

  conceptPickerButton(rowKey: AdministrativeConceptRowKey): Locator {
    const testId = `conceptos-nov-ad-table-concept-picker-button-row--${this.resolveRowKey(rowKey)}`;

    return this.page.locator(`button[data-testid="${testId}"]`);
  }

  pageSizeButton(size: PageSize): Locator {
    return this.page.getByTestId(
      `conceptos-nov-ad-table-pager-page-size-button--${size}`,
    );
  }

  visibleRows(): Locator {
    return this.table.locator(
      'tbody tr[data-testid^="conceptos-nov-ad-table-row--"]:visible',
    );
  }

  async readPagerRange(): Promise<PagerRange> {
    const summary = (await this.pagerSummary.textContent())?.trim() ?? "";
    const match = /^(\d+)-(\d+)\s+de\s+(\d+)$/.exec(summary);

    if (!match) {
      throw new Error(
        `Unexpected administrative-update-concepts pager summary: "${summary}"`,
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

    throw new Error("No administrative-update-concepts page size is selected");
  }

  private resolveRowKey(rowKey: AdministrativeConceptRowKey): string {
    if (typeof rowKey === "string") {
      return rowKey;
    }

    return `${rowKey.conceptId}-${rowKey.noveltyCode.toLowerCase()}`;
  }
}
