import type { Locator, Page } from '@playwright/test';

type PageSize = 10 | 25 | 50 | 100;

export class RiesgosProfesionalesPage {
  readonly createButton: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;
  readonly deleteButton: Locator;
  readonly codeInput: Locator;
  readonly classInput: Locator;
  readonly percentageInput: Locator;
  readonly activityInput: Locator;
  readonly openActivityModalButton: Locator;
  readonly previousPageButton: Locator;
  readonly nextPageButton: Locator;
  readonly activityModal: Locator;
  readonly closeActivityModalButton: Locator;
  readonly activitySearchInput: Locator;
  readonly openActivitySearchButton: Locator;
  readonly previousActivityPageButton: Locator;
  readonly nextActivityPageButton: Locator;
  readonly acceptActivityButton: Locator;
  readonly cancelActivityButton: Locator;

  constructor(readonly page: Page) {
    this.createButton = page.getByTestId(
      'riesgos-profesionales-topbar-create-button',
    );
    this.saveButton = page.getByTestId(
      'riesgos-profesionales-topbar-save-button',
    );
    this.cancelButton = page.getByTestId(
      'riesgos-profesionales-topbar-cancel-button',
    );
    this.deleteButton = page.getByTestId(
      'riesgos-profesionales-topbar-delete-button',
    );
    this.codeInput = page.getByTestId(
      'riesgos-profesionales-form-codigo-input',
    );
    this.classInput = page.getByTestId(
      'riesgos-profesionales-form-clase-input',
    );
    this.percentageInput = page.getByTestId(
      'riesgos-profesionales-form-porcentaje-input',
    );
    this.activityInput = page.getByTestId(
      'riesgos-profesionales-form-actividad-input',
    );
    this.openActivityModalButton = page.getByTestId(
      'riesgos-profesionales-actividad-modal-open-button',
    );
    this.previousPageButton = page.getByTestId(
      'riesgos-profesionales-table-previous-page-button',
    );
    this.nextPageButton = page.getByTestId(
      'riesgos-profesionales-table-next-page-button',
    );
    this.activityModal = page.getByTestId(
      'riesgos-profesionales-actividad-modal-panel',
    );
    this.closeActivityModalButton = page.getByTestId(
      'riesgos-profesionales-actividad-modal-close-button',
    );
    this.activitySearchInput = page.getByTestId(
      'riesgos-profesionales-actividad-modal-search-input',
    );
    this.openActivitySearchButton = page.getByTestId(
      'riesgos-profesionales-actividad-modal-search-open-button',
    );
    this.previousActivityPageButton = page.getByTestId(
      'riesgos-profesionales-actividad-modal-table-previous-page-button',
    );
    this.nextActivityPageButton = page.getByTestId(
      'riesgos-profesionales-actividad-modal-table-next-page-button',
    );
    this.acceptActivityButton = page.getByTestId(
      'riesgos-profesionales-actividad-modal-accept-button',
    );
    this.cancelActivityButton = page.getByTestId(
      'riesgos-profesionales-actividad-modal-cancel-button',
    );
  }

  riskRow(id: string | number): Locator {
    return this.page.getByTestId(
      `riesgos-profesionales-table-riesgo-row--${id}`,
    );
  }

  riskCheckbox(id: string | number): Locator {
    return this.page.locator(
      `bds-checkbox[data-testid="riesgos-profesionales-table-select-checkbox--${id}"] input[type="checkbox"]`,
    );
  }

  pageSizeButton(size: PageSize): Locator {
    return this.page.getByTestId(
      `riesgos-profesionales-table-page-size-button--${size}`,
    );
  }

  activityOptionRow(id: string | number): Locator {
    return this.page.getByTestId(
      `riesgos-profesionales-actividad-modal-option-row--${id}`,
    );
  }

  activityPageSizeButton(size: PageSize): Locator {
    return this.page.getByTestId(
      `riesgos-profesionales-actividad-modal-table-page-size-button--${size}`,
    );
  }
}
