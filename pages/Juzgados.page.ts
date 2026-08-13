import type { Locator, Page } from '@playwright/test';

type PageSize = 10 | 25 | 50 | 100;

export class JuzgadosPage {
  readonly saveButton: Locator;
  readonly clearButton: Locator;
  readonly deleteButton: Locator;
  readonly codeInput: Locator;
  readonly nameInput: Locator;
  readonly abbreviationInput: Locator;
  readonly citySelect: Locator;
  readonly previousPageButton: Locator;
  readonly nextPageButton: Locator;

  constructor(readonly page: Page) {
    this.saveButton = page.getByTestId('juzgados-topbar-save-button');
    this.clearButton = page.getByTestId('juzgados-topbar-clear-button');
    this.deleteButton = page.getByTestId('juzgados-topbar-delete-button');
    this.codeInput = page.locator(
      'input[data-testid="juzgados-form-codigo-input"]',
    );
    this.nameInput = page.locator(
      'input[data-testid="juzgados-form-nombre-input"]',
    );
    this.abbreviationInput = page.locator(
      'input[data-testid="juzgados-form-abreviatura-input"]',
    );
    this.citySelect = page.locator(
      'mat-select[data-testid="juzgados-form-ciudad-select"]',
    );
    this.previousPageButton = page.getByTestId(
      'juzgados-table-previous-page-button',
    );
    this.nextPageButton = page.getByTestId(
      'juzgados-table-next-page-button',
    );
  }

  row(id: string | number): Locator {
    return this.page.getByTestId(`juzgados-table-juzgado-row--${id}`);
  }

  checkbox(id: string | number): Locator {
    return this.page.locator(
      `bds-checkbox[data-testid="juzgados-table-select-checkbox--${id}"] input[type="checkbox"]`,
    );
  }

  pageSizeButton(size: PageSize): Locator {
    return this.page.getByTestId(
      `juzgados-table-page-size-button--${size}`,
    );
  }
}
