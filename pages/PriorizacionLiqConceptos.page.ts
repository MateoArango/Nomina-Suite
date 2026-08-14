import type { Locator, Page } from "@playwright/test";

type PageSize = 10 | 25 | 50 | 100;

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
}
