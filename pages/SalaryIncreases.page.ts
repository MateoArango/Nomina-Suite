import type { Locator, Page } from "@playwright/test";

type PageSize = 10 | 25 | 50 | 100;
type Lookup = "employee-type" | "payment-unit" | "profession" | "position" | "level" | "grade";
type Picker = "position" | "section";
type Dialog = "empty-results" | "missing-calculation" | "missing-selection"
  | "positions-confirmation" | "save-confirmation" | "api-error";
type DialogAction = "confirm" | "deny" | "cancel" | "close";
export type SalaryIncreaseColumn =
  | "nNit" | "scNombre" | "scDetalleCargo" | "ssSeccion" | "scUnidadDePago"
  | "sDescripcion" | "tipoPension" | "tipoCotizante" | "ddIngreso"
  | "ndSalarioMes" | "nuevoSalario" | "salarioFijo" | "nuevoSalarioFijo";

// IDs come from the salary increase screen and its shared picker/pager components.
// Conditional results and dialog controls are available only in their respective states.
export class SalaryIncreasesPage {
  readonly loadingStrip: Locator;
  readonly toolbar: Locator;
  readonly tabs: Locator;
  readonly filterTab: Locator;
  readonly increasesTab: Locator;
  readonly employeeTypeSelect: Locator;
  readonly paymentUnitSelect: Locator;
  readonly professionSelect: Locator;
  readonly levelSelect: Locator;
  readonly gradeSelect: Locator;
  readonly documentStartInput: Locator;
  readonly documentEndInput: Locator;
  readonly salaryStartInput: Locator;
  readonly salaryEndInput: Locator;
  readonly startDateInput: Locator;
  readonly decreeInput: Locator;
  readonly percentageInput: Locator;
  readonly increaseValueInput: Locator;
  readonly hireDateInput: Locator;
  readonly roundToHundredCheckbox: Locator;
  readonly increaseByPointsCheckbox: Locator;
  readonly resetFiltersButton: Locator;
  readonly calculateButton: Locator;
  readonly selectAllButton: Locator;
  readonly exportButton: Locator;
  readonly undoButton: Locator;
  readonly saveButton: Locator;
  readonly searchFindButton: Locator;
  readonly searchNextButton: Locator;
  readonly searchInput: Locator;
  readonly searchOpenButton: Locator;
  readonly searchClearButton: Locator;
  readonly searchCloseButton: Locator;
  readonly table: Locator;
  readonly previousPageButton: Locator;
  readonly nextPageButton: Locator;
  readonly positionHost: Locator;
  readonly positionOpenButton: Locator;
  readonly positionPanel: Locator;
  readonly positionSearchInput: Locator;
  readonly positionClearButton: Locator;
  readonly positionStatus: Locator;
  readonly positionTable: Locator;
  readonly positionEmptyState: Locator;
  readonly sectionHost: Locator;
  readonly sectionOpenButton: Locator;
  readonly sectionPanel: Locator;
  readonly sectionSearchInput: Locator;
  readonly sectionClearButton: Locator;
  readonly sectionStatus: Locator;
  readonly sectionTable: Locator;
  readonly sectionEmptyState: Locator;

  constructor(readonly page: Page) {
    this.loadingStrip = this.byId("loading-strip");
    this.toolbar = this.byId("topbar");
    this.tabs = this.byId("tabs");
    this.filterTab = this.byId("tab-filter");
    this.increasesTab = this.byId("tab-increases");
    this.employeeTypeSelect = this.control("filter-employee-type-select", "mat-select");
    this.paymentUnitSelect = this.control("filter-payment-unit-select", "mat-select");
    this.professionSelect = this.control("filter-profession-select", "mat-select");
    this.levelSelect = this.control("filter-level-select", "mat-select");
    this.gradeSelect = this.control("filter-grade-select", "mat-select");
    this.documentStartInput = this.control("filter-nit-start-input", "input");
    this.documentEndInput = this.control("filter-nit-end-input", "input");
    this.salaryStartInput = this.control("filter-salary-start-input", "input");
    this.salaryEndInput = this.control("filter-salary-end-input", "input");
    this.startDateInput = this.control("filter-start-date-input", "input");
    this.decreeInput = this.control("filter-decree-input", "input");
    this.percentageInput = this.control("filter-percentage-input", "input");
    this.increaseValueInput = this.control("filter-value-input", "input");
    this.hireDateInput = this.control("filter-hire-date-input", "input");
    this.roundToHundredCheckbox = this.checkbox("filter-round-hundred-checkbox");
    this.increaseByPointsCheckbox = this.checkbox("filter-by-points-checkbox");
    this.resetFiltersButton = this.control("filter-reset-button", "button");
    this.calculateButton = this.control("filter-calculate-button", "button");
    this.selectAllButton = this.control("select-all-button", "button");
    this.exportButton = this.control("export-button", "button");
    this.undoButton = this.control("undo-button", "button");
    this.saveButton = this.control("save-button", "button");
    this.searchFindButton = this.control("search-find-button", "button");
    this.searchNextButton = this.control("search-next-button", "button");
    this.searchInput = this.control("search-input", "input");
    this.searchOpenButton = this.byId("search-open-button");
    this.searchClearButton = this.byId("search-clear-button");
    this.searchCloseButton = this.byId("search-close-button");
    this.table = this.byId("increases-table");
    this.previousPageButton = this.control("increases-pager-previous-page-button", "button");
    this.nextPageButton = this.control("increases-pager-next-page-button", "button");
    this.positionHost = this.byId("filter-position-host");
    this.positionOpenButton = this.control("filter-position-open-button", "button");
    this.positionPanel = this.byId("filter-position-panel");
    this.positionSearchInput = this.control("filter-position-search-input", "input");
    this.positionClearButton = this.control("filter-position-clear-button", "button");
    this.positionStatus = this.byId("filter-position-status");
    this.positionTable = this.byId("filter-position-table");
    this.positionEmptyState = this.byId("filter-position-empty-state");
    this.sectionHost = this.byId("filter-section-host");
    this.sectionOpenButton = this.control("filter-section-open-button", "button");
    this.sectionPanel = this.byId("filter-section-panel");
    this.sectionSearchInput = this.control("filter-section-search-input", "input");
    this.sectionClearButton = this.control("filter-section-clear-button", "button");
    this.sectionStatus = this.byId("filter-section-status");
    this.sectionTable = this.byId("filter-section-table");
    this.sectionEmptyState = this.byId("filter-section-empty-state");
  }

  private byId(suffix: string): Locator {
    return this.page.getByTestId(`aumento-sueldo-${suffix}`);
  }

  // Wrappers and their interactive children share IDs; intersect with the native control.
  private control(suffix: string, tag: string): Locator {
    return this.byId(suffix).and(this.page.locator(tag));
  }

  private checkbox(suffix: string): Locator {
    return this.control(suffix, "mat-checkbox").locator('input[type="checkbox"]');
  }

  private testIdToken(value: string | number | null): string {
    return String(value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "empty";
  }

  async goto(): Promise<void> {
    await this.page.goto("https://nomina-qa.adacsc.co/aumento-sueldo");
    await this.filterTab.waitFor({ state: "visible" });
  }

  async openFilters(): Promise<void> {
    await this.filterTab.click();
  }

  async openIncreases(): Promise<void> {
    await this.increasesTab.click();
  }

  lookupOption(lookup: Lookup, id: string | number): Locator {
    return this.byId(`${lookup}-option--${id}`);
  }

  pickerRow(picker: Picker, id: string | number): Locator {
    return this.byId(`filter-${picker}-row--${id}`);
  }

  row(employeeId: string | number): Locator {
    return this.byId(`increases-row--${employeeId}`);
  }

  rowCheckbox(employeeId: string | number): Locator {
    return this.checkbox(`increases-select-checkbox--${employeeId}`);
  }

  visibleRows(): Locator {
    return this.page.getByTestId(/^aumento-sueldo-increases-row--/).filter({ visible: true });
  }

  pageSizeButton(size: PageSize): Locator {
    return this.byId(`increases-pager-page-size-button--${size}`);
  }

  columnFilterButton(column: SalaryIncreaseColumn): Locator {
    return this.byId(`column-filter-open-button--${this.testIdToken(column)}`);
  }

  columnFilterMenu(column: SalaryIncreaseColumn): Locator {
    return this.byId(`column-filter-menu--${this.testIdToken(column)}`);
  }

  columnSortButton(column: SalaryIncreaseColumn, direction: "asc" | "desc"): Locator {
    return this.byId(`column-sort-${direction}-button--${this.testIdToken(column)}`);
  }

  columnClearFilterButton(column: SalaryIncreaseColumn): Locator {
    return this.byId(`column-filter-clear-button--${this.testIdToken(column)}`);
  }

  columnSelectAllCheckbox(column: SalaryIncreaseColumn): Locator {
    return this.checkbox(`column-select-all-checkbox--${this.testIdToken(column)}`);
  }

  columnOptionCheckbox(column: SalaryIncreaseColumn, value: string | number | null): Locator {
    return this.checkbox(`column-option-checkbox--${this.testIdToken(column)}-${this.testIdToken(value)}`);
  }

  dialog(kind: Dialog): Locator {
    return this.byId(`${kind}-dialog`);
  }

  dialogButton(kind: Dialog, action: DialogAction): Locator {
    return this.byId(`${kind}-${action}-button`);
  }
}

