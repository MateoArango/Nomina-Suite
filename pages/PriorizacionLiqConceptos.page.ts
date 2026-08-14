import type { Locator, Page } from "@playwright/test";

type PageSize = 10 | 25 | 50 | 100;

export type PagerRange = {
  start: number;
  end: number;
  total: number;
};

export class PriorizacionLiqConceptosPage {
  readonly saveButton: Locator;
  readonly cancelButton: Locator;
  readonly assignButton: Locator;
  readonly removeButton: Locator;
  readonly moveUpButton: Locator;
  readonly moveDownButton: Locator;
  readonly availablePreviousPageButton: Locator;
  readonly availableNextPageButton: Locator;
  readonly priorityPreviousPageButton: Locator;
  readonly priorityNextPageButton: Locator;
  readonly availableTable: Locator;
  readonly priorityTable: Locator;
  readonly availablePagerSummary: Locator;
  readonly priorityPagerSummary: Locator;

  constructor(readonly page: Page) {
    this.saveButton = page.getByTestId(
      "priorizacion-conceptos-header-save-button",
    );
    this.cancelButton = page.getByTestId(
      "priorizacion-conceptos-header-cancel-button",
    );
    this.assignButton = page.getByTestId(
      "priorizacion-conceptos-transfer-assign-button",
    );
    this.removeButton = page.getByTestId(
      "priorizacion-conceptos-transfer-remove-button",
    );
    this.moveUpButton = page.getByTestId(
      "priorizacion-conceptos-transfer-move-up-button",
    );
    this.moveDownButton = page.getByTestId(
      "priorizacion-conceptos-transfer-move-down-button",
    );
    this.availablePreviousPageButton = page.getByTestId(
      "priorizacion-conceptos-available-table-previous-page-button",
    );
    this.availableNextPageButton = page.getByTestId(
      "priorizacion-conceptos-available-table-next-page-button",
    );
    this.priorityPreviousPageButton = page.getByTestId(
      "priorizacion-conceptos-priority-table-previous-page-button",
    );
    this.priorityNextPageButton = page.getByTestId(
      "priorizacion-conceptos-priority-table-next-page-button",
    );
    this.availableTable = page.locator(
      'table[data-testid-pager-prefix="priorizacion-conceptos-available-table"]',
    );
    this.priorityTable = page.locator(
      'table[data-testid-pager-prefix="priorizacion-conceptos-priority-table"]',
    );
    this.availablePagerSummary = this.availableTable
      .locator(
        "xpath=ancestor::div[contains(@class, 'table-wrap')][1]/following-sibling::div[contains(@class, 'erp-table-pager')]",
      )
      .locator(".erp-table-pager__summary");
    this.priorityPagerSummary = this.priorityTable
      .locator(
        "xpath=ancestor::div[contains(@class, 'table-wrap')][1]/following-sibling::div[contains(@class, 'erp-table-pager')]",
      )
      .locator(".erp-table-pager__summary");
  }

  availableConceptRow(id: string | number): Locator {
    return this.page.getByTestId(
      `priorizacion-conceptos-available-table-concept-row--${id}`,
    );
  }

  priorityConceptRow(id: string | number): Locator {
    return this.page.getByTestId(
      `priorizacion-conceptos-priority-table-concept-row--${id}`,
    );
  }

  availablePageSizeButton(size: PageSize): Locator {
    return this.page.getByTestId(
      `priorizacion-conceptos-available-table-page-size-button--${size}`,
    );
  }

  priorityPageSizeButton(size: PageSize): Locator {
    return this.page.getByTestId(
      `priorizacion-conceptos-priority-table-page-size-button--${size}`,
    );
  }

  availableVisibleRows(): Locator {
    return this.availableTable.locator(
      'tbody tr[data-testid^="priorizacion-conceptos-available-table-concept-row--"]:visible',
    );
  }

  priorityVisibleRows(): Locator {
    return this.priorityTable.locator(
      'tbody tr[data-testid^="priorizacion-conceptos-priority-table-concept-row--"]:visible',
    );
  }

  async readPagerRange(summary: Locator): Promise<PagerRange> {
    const text = (await summary.textContent())?.trim() ?? "";
    const match = /^(\d+)-(\d+)\s+de\s+(\d+)$/.exec(text);

    if (!match) {
      throw new Error(`Unexpected pager summary: "${text}"`);
    }

    return {
      start: Number(match[1]),
      end: Number(match[2]),
      total: Number(match[3]),
    };
  }
}
