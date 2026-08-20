import type { Locator, Page } from '@playwright/test';

type PageSize = 10 | 25 | 50 | 100;

export class RiesgosProfesionalesPage {
  readonly heading: Locator;
  readonly toolbar: Locator;
  readonly form: Locator;
  readonly riskTable: Locator;
  readonly pager: Locator;
  readonly pagerSummary: Locator;
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
    const routeHost = page.getByTestId('app-shell-route-host');

    this.heading = routeHost.getByText('Riesgos Profesionales', {
      exact: true,
    });
    this.createButton = page.getByTestId(
      'riesgos-profesionales-topbar-create-button',
    );
    this.toolbar = this.createButton.locator('xpath=ancestor::bds-top-bar');
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
    this.form = this.codeInput.locator(
      'xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " card-content ")][1]',
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
    this.riskTable = routeHost.locator(
      'table[data-testid-pager-prefix="riesgos-profesionales-table"]',
    );
    this.pager = this.previousPageButton.locator(
      'xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " erp-table-pager ")][1]',
    );
    this.pagerSummary = this.pager.locator('.erp-table-pager__summary');
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

  visibleRiskRows(): Locator {
    return this.riskTable.locator(
      'tbody tr[data-testid^="riesgos-profesionales-table-riesgo-row--"]',
    );
  }

  async readPagerRange(): Promise<{
    start: number;
    end: number;
    total: number;
  }> {
    const summary = (await this.pagerSummary.textContent())?.trim() ?? '';
    const match = summary.match(/^(\d+)-(\d+) de (\d+)$/);

    if (!match) {
      throw new Error(`Unexpected occupational-risks pager summary: "${summary}"`);
    }

    return {
      start: Number(match[1]),
      end: Number(match[2]),
      total: Number(match[3]),
    };
  }

  async selectedPageSize(): Promise<PageSize> {
    for (const size of [10, 25, 50, 100] as const) {
      if ((await this.pageSizeButton(size).getAttribute('aria-pressed')) === 'true') {
        return size;
      }
    }

    throw new Error('No occupational-risks page size is selected');
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
