import type { Locator, Page } from "@playwright/test";

/** Locators for the Permissions screen and employee selector. */
export class PermissionsPage {
  readonly routeHost: Locator;
  readonly view: Locator;
  readonly loadingStatus: Locator;
  readonly heading: Locator;
  readonly subtitle: Locator;
  readonly newButton: Locator;
  readonly saveButton: Locator;
  readonly deleteButton: Locator;
  readonly employeeSection: Locator;
  readonly employeeHeading: Locator;
  readonly employeeNameValue: Locator;
  readonly historyTable: Locator;
  readonly historyRows: Locator;
  readonly employeeDocumentInput: Locator;
  readonly employeeSearchButton: Locator;
  readonly employeeSelectorOpenButton: Locator;
  readonly historySection: Locator;
  readonly historyHeading: Locator;
  readonly historyEmptyState: Locator;
  readonly historyEmptyTitle: Locator;
  readonly historyEmptyMessage: Locator;
  readonly detailsSection: Locator;
  readonly detailsHeading: Locator;
  readonly startDateInput: Locator;
  readonly startDateCalendarButton: Locator;
  readonly endDateInput: Locator;
  readonly endDateCalendarButton: Locator;
  readonly descriptionInput: Locator;
  readonly compensatoryGroup: Locator;
  readonly compensatoryYesCheckbox: Locator;
  readonly compensatoryNoCheckbox: Locator;
  readonly permissionGroup: Locator;
  readonly permissionYesCheckbox: Locator;
  readonly permissionNoCheckbox: Locator;
  readonly administrativeActInput: Locator;
  readonly administrativeActDateInput: Locator;
  readonly administrativeActDateCalendarButton: Locator;
  readonly approvedGroup: Locator;
  readonly approvedYesCheckbox: Locator;
  readonly approvedNoCheckbox: Locator;
  readonly contributionBase: Locator;
  readonly contributionBaseLabel: Locator;
  readonly contributionBaseValue: Locator;
  readonly employeeSelectorPanel: Locator;
  readonly employeeSelectorHeading: Locator;
  readonly employeeSelectorCloseButton: Locator;
  readonly employeeSelectorContent: Locator;
  readonly employeeSelectorBody: Locator;
  readonly employeeSelectorQueryInput: Locator;
  readonly employeeSelectorQueryHint: Locator;
  readonly employeeSelectorTypeSelect: Locator;
  readonly employeeSelectorTable: Locator;
  readonly employeeSelectorColumnHeaders: Locator;
  readonly employeeSelectorNameColumnHeader: Locator;
  readonly employeeSelectorDocumentColumnHeader: Locator;
  readonly employeeSelectorStatusColumnHeader: Locator;
  readonly employeeSelectorTypeColumnHeader: Locator;
  readonly employeeSelectorRows: Locator;
  readonly employeeSelectorVisibleRows: Locator;
  readonly employeeSelectorPager: Locator;
  readonly employeeSelectorPageSizeButtons: Locator;
  readonly employeeSelectorPreviousPageButton: Locator;
  readonly employeeSelectorNextPageButton: Locator;
  readonly employeeSelectorPageSummary: Locator;

  constructor(readonly page: Page) {
    this.routeHost = page.getByTestId("app-shell-route-host");
    this.view = this.routeHost.locator("app-vacaciones-licencias-ascensos-permisos-view");
    this.loadingStatus = this.view.getByTestId("permisos-loading-status");
    this.heading = this.view.locator("h1.page-title");
    this.subtitle = this.view.locator(".page-subtitle");
    this.newButton = this.view.locator('button[data-testid="permisos-actions-new-button"]');
    this.saveButton = this.view.locator('button[data-testid="permisos-actions-save-button"]');
    this.deleteButton = this.view.locator('button[data-testid="permisos-actions-delete-button"]');

    this.employeeDocumentInput = this.view.locator('input[data-testid="permisos-employee-document-search-input"]');
    this.employeeSearchButton = this.view.locator('button[data-testid="permisos-employee-search-button"]');
    this.employeeSelectorOpenButton = this.view.locator('button[data-testid="permisos-employee-selector-open-button"]');
    this.employeeSection = this.view.locator("bds-card").filter({ has: page.locator('input[data-testid="permisos-employee-document-search-input"]') });
    this.employeeHeading = this.employeeSection.getByRole("heading", { level: 2 });
    this.employeeNameValue = this.employeeSection.locator(".field-pair__value").first();

    // The empty history in the supplied HTML has no table or record IDs.
    this.historySection = this.view.locator("bds-card").filter({
      hasNot: page.locator('input[data-testid="permisos-employee-document-search-input"]'),
    }).filter({ hasNot: page.getByTestId("permisos-form-start-date-input") });
    this.historyHeading = this.historySection.getByRole("heading", { level: 2 });
    this.historyTable = this.historySection.getByTestId("permisos-list-table");
    this.historyRows = this.historyTable.locator('tr[data-testid^="permisos-table-row--"]');
    this.historyEmptyState = this.historySection.locator(".empty-state");
    this.historyEmptyTitle = this.historyEmptyState.locator(".empty-state__title");
    this.historyEmptyMessage = this.historyEmptyState.locator(".empty-state__subtitle");

    this.startDateInput = this.view.locator('input[data-testid="permisos-form-start-date-input"]');
    this.startDateCalendarButton = this.view.getByTestId("permisos-form-start-date-open-button").getByRole("button");
    this.endDateInput = this.view.locator('input[data-testid="permisos-form-end-date-input"]');
    this.endDateCalendarButton = this.view.getByTestId("permisos-form-end-date-open-button").getByRole("button");
    this.descriptionInput = this.view.locator('input[data-testid="permisos-form-description-input"]');
    this.detailsSection = this.view.locator("bds-card").filter({ has: page.locator('input[data-testid="permisos-form-start-date-input"]') });
    this.detailsHeading = this.detailsSection.getByRole("heading", { level: 2 });
    // Both checkbox wrappers carry the test ID; select only the native input.
    this.compensatoryYesCheckbox = this.view.locator('mat-checkbox[data-testid="permisos-form-compensatory-yes-checkbox"] input[type="checkbox"]');
    this.compensatoryNoCheckbox = this.view.locator('mat-checkbox[data-testid="permisos-form-compensatory-no-checkbox"] input[type="checkbox"]');
    this.compensatoryGroup = this.detailsSection.getByRole("group").filter({ has: page.locator('mat-checkbox[data-testid="permisos-form-compensatory-yes-checkbox"] input[type="checkbox"]') });
    this.permissionYesCheckbox = this.view.locator('mat-checkbox[data-testid="permisos-form-permission-yes-checkbox"] input[type="checkbox"]');
    this.permissionNoCheckbox = this.view.locator('mat-checkbox[data-testid="permisos-form-permission-no-checkbox"] input[type="checkbox"]');
    this.permissionGroup = this.detailsSection.getByRole("group").filter({ has: page.locator('mat-checkbox[data-testid="permisos-form-permission-yes-checkbox"] input[type="checkbox"]') });
    this.administrativeActInput = this.view.locator('input[data-testid="permisos-form-administrative-act-input"]');
    this.administrativeActDateInput = this.view.locator('input[data-testid="permisos-form-administrative-act-date-input"]');
    this.administrativeActDateCalendarButton = this.view.getByTestId("permisos-form-administrative-act-date-open-button").getByRole("button");
    this.approvedYesCheckbox = this.view.locator('mat-checkbox[data-testid="permisos-form-approved-yes-checkbox"] input[type="checkbox"]');
    this.approvedNoCheckbox = this.view.locator('mat-checkbox[data-testid="permisos-form-approved-no-checkbox"] input[type="checkbox"]');
    this.approvedGroup = this.detailsSection.getByRole("group").filter({ has: page.locator('mat-checkbox[data-testid="permisos-form-approved-yes-checkbox"] input[type="checkbox"]') });
    this.contributionBase = this.detailsSection.locator(".ibc-field");
    this.contributionBaseLabel = this.contributionBase.locator(".field-pair__label");
    this.contributionBaseValue = this.contributionBase.locator(".field-pair__value");

    this.employeeSelectorPanel = this.view.getByTestId("permisos-employee-selector-panel");
    this.employeeSelectorHeading = this.employeeSelectorPanel.getByRole("heading", { level: 2 });
    this.employeeSelectorCloseButton = this.employeeSelectorPanel.getByTestId("permisos-employee-selector-close-button");
    this.employeeSelectorContent = this.employeeSelectorPanel.locator(".bds-sheet-content");
    this.employeeSelectorBody = this.employeeSelectorPanel.getByTestId("permisos-employee-selector-content");
    this.employeeSelectorQueryInput = this.employeeSelectorPanel.locator('input[data-testid="permisos-employee-selector-query-input"]');
    this.employeeSelectorQueryHint = this.employeeSelectorPanel.locator('bds-form-field[data-testid="permisos-employee-selector-query-input"] mat-hint');
    this.employeeSelectorTypeSelect = this.employeeSelectorPanel.locator('mat-select[data-testid="permisos-employee-selector-type-select"]');
    this.employeeSelectorTable = this.employeeSelectorPanel.getByTestId("permisos-employee-selector-table");
    this.employeeSelectorColumnHeaders = this.employeeSelectorTable.getByRole("columnheader");
    this.employeeSelectorNameColumnHeader = this.employeeSelectorColumnHeaders.nth(0);
    this.employeeSelectorDocumentColumnHeader = this.employeeSelectorColumnHeaders.nth(1);
    this.employeeSelectorStatusColumnHeader = this.employeeSelectorColumnHeaders.nth(2);
    this.employeeSelectorTypeColumnHeader = this.employeeSelectorColumnHeaders.nth(3);
    // Pagination keeps off-page rows in the DOM with the hidden attribute.
    this.employeeSelectorRows = this.employeeSelectorTable.locator('tr[data-testid^="permisos-employee-selector-row--"]');
    this.employeeSelectorVisibleRows = this.employeeSelectorRows.filter({ visible: true });
    this.employeeSelectorPager = this.employeeSelectorPanel.locator(".erp-table-pager");
    this.employeeSelectorPageSizeButtons = this.employeeSelectorPager.locator('button[data-testid^="permisos-employee-selector-table-pager-page-size-button--"]');
    this.employeeSelectorPreviousPageButton = this.employeeSelectorPager.getByTestId("permisos-employee-selector-table-pager-previous-page-button");
    this.employeeSelectorNextPageButton = this.employeeSelectorPager.getByTestId("permisos-employee-selector-table-pager-next-page-button");
    this.employeeSelectorPageSummary = this.employeeSelectorPager.locator(".erp-table-pager__summary");
  }

  employeeSelectorRow(id: string | number): Locator {
    return this.employeeSelectorTable.getByTestId(`permisos-employee-selector-row--${id}`);
  }

  historyRow(id: string | number): Locator {
    return this.historyTable.getByTestId(`permisos-table-row--${id}`);
  }

  employeeSelectorCell(
    id: string | number,
    column: "name" | "document" | "status" | "type",
  ): Locator {
    const columnIndexes = { name: 0, document: 1, status: 2, type: 3 };
    return this.employeeSelectorRow(id).getByRole("cell").nth(columnIndexes[column]);
  }

  employeeSelectorPageSizeButton(size: 10 | 25 | 50 | 100): Locator {
    return this.employeeSelectorPager.getByTestId(
      `permisos-employee-selector-table-pager-page-size-button--${size}`,
    );
  }

  async goto(): Promise<void> {
    await this.page.goto("https://nomina-qa.adacsc.co/permisos");
  }
}
