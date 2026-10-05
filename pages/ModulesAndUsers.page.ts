import { expect, type Locator, type Page } from "@playwright/test";

/** Page object for the Users and Modules administration screen. */
export class ModulesAndUsersPage {
  readonly routeHost: Locator;
  readonly reloadButton: Locator;
  readonly newButton: Locator;
  readonly saveButton: Locator;
  readonly undoButton: Locator;
  readonly deleteButton: Locator;
  readonly listTab: Locator;
  readonly userTab: Locator;
  readonly modulesTab: Locator;
  readonly inheritTab: Locator;
  readonly listTable: Locator;
  readonly searchInput: Locator;
  readonly openSearchButton: Locator;
  readonly statusSelect: Locator;
  readonly userIdNumberField: Locator;
  readonly userNameField: Locator;
  readonly userLoginField: Locator;
  readonly userEmailField: Locator;
  readonly userPasswordField: Locator;
  readonly userPasswordConfirmationField: Locator;
  readonly userPositionSelect: Locator;
  readonly userDependencySelect: Locator;
  readonly userStatusSelect: Locator;
  readonly modulesTable: Locator;
  readonly expandAllModulesButton: Locator;
  readonly collapseAllModulesButton: Locator;


  constructor(readonly page: Page) {
    this.routeHost = page.getByTestId("app-shell-route-host");
    this.reloadButton = page.getByTestId("usuarios-modulos-reload-button");
    this.newButton = page.getByTestId("usuarios-modulos-new-button");
    this.saveButton = page.getByTestId("usuarios-modulos-save-button");
    this.undoButton = page.getByTestId("usuarios-modulos-undo-button");
    this.deleteButton = page.getByTestId("usuarios-modulos-delete-button");
    this.listTab = page.getByTestId("usuarios-modulos-list-tab");
    this.userTab = page.getByTestId("usuarios-modulos-user-tab");
    this.modulesTab = page.getByTestId("usuarios-modulos-modules-tab");
    this.inheritTab = page.getByTestId("usuarios-modulos-inherit-tab");
    this.listTable = page.getByTestId("usuarios-modulos-list-table");
    this.searchInput = page.getByTestId("usuarios-modulos-list-search-input");
    this.openSearchButton = page.getByTestId("usuarios-modulos-list-search-open-button");
    this.statusSelect = page.getByRole("combobox", { name: "Estado" });
    this.userIdNumberField = page.locator(
      'input[data-testid="usuarios-modulos-user-id-number-field"]',
    );
    this.userNameField = page.getByRole("textbox", { name: "Nombre", exact: true });
    this.userLoginField = page.getByRole("textbox", { name: "Login", exact: true });
    this.userEmailField = page.getByRole("textbox", { name: "E-Mail", exact: true });
    this.userPasswordField = page.getByRole("textbox", { name: "Password", exact: true });
    this.userPasswordConfirmationField = page.getByRole("textbox", {
      name: "Confirmar Password",
      exact: true,
    });
    this.userPositionSelect = page.getByRole("combobox", { name: "Cargo", exact: true });
    this.userDependencySelect = page.getByRole("combobox", { name: "Dependencia", exact: true });
    this.userStatusSelect = page.getByTestId("usuarios-modulos-user-status-select");
    this.modulesTable = page.getByTestId("usuarios-modulos-modules-table");

    this.expandAllModulesButton = page.getByTestId("usuarios-modulos-modules-expand-all-button");
    this.collapseAllModulesButton = page.getByTestId("usuarios-modulos-modules-collapse-all-button");
  }

  columnFilter(column: "cargo" | "cedula" | "depedencia" | "nombre"): Locator {
    return this.page.getByTestId(`usuarios-modulos-list-column-filter-button--${column}`);
  }

  row(id: string | number): Locator {
    return this.page.getByTestId(`usuarios-modulos-list-row--${id}`);
  }

  deleteCheckbox(id: string | number): Locator {
    return this.page.getByTestId(`usuarios-modulos-list-delete-checkbox--${id}`);
  }

  moduleRow(id: string | number): Locator {
    return this.page.getByTestId(`usuarios-modulos-modules-row--${id}`);
  }

  moduleExpandButton(id: string | number): Locator {
    return this.page.getByTestId(`usuarios-modulos-modules-expand-button--${id}`);
  }

  modulePermission(
    permission: "assign" | "delete" | "edit" | "insert" | "print",
    id: string | number,
  ): Locator {
    return this.page.getByTestId(`usuarios-modulos-modules-${permission}-checkbox--${id}`);
  }

  modulePermissions(id: string | number): Record<
    "assign" | "delete" | "edit" | "insert" | "print",
    Locator
  > {
    return {
      assign: this.modulePermission("assign", id),
      delete: this.modulePermission("delete", id),
      edit: this.modulePermission("edit", id),
      insert: this.modulePermission("insert", id),
      print: this.modulePermission("print", id),
    };
  }

  async goto(): Promise<void> {
    await this.page.goto("https://nomina-qa.adacsc.co/usuarios-modulos");
  }

  rows(): Locator {
    return this.page.getByTestId(/^usuarios-modulos-list-row--/);
  }

  async reload(): Promise<void> {
    await this.reloadButton.click();
  }

  async startNew(): Promise<void> {
    await this.newButton.click();
  }

  async save(): Promise<void> {
    await this.saveButton.click();
  }

  async undo(): Promise<void> {
    await this.undoButton.click();
  }

  async deleteSelected(): Promise<void> {
    await this.deleteButton.click();
  }

  async expandAllModules(): Promise<void> {
    await this.expandAllModulesButton.click();
  }

  async collapseAllModules(): Promise<void> {
    await this.collapseAllModulesButton.click();
  }

  async setModulePermission(
    permission: "assign" | "delete" | "edit" | "insert" | "print",
    id: string | number,
    checked: boolean,
  ): Promise<void> {
    await this.modulePermission(permission, id).setChecked(checked);
  }

  async searchFor(value: string): Promise<void> {
    await this.searchInput.fill(value);
    await this.searchButton.click();
  }

  async expectLoaded(): Promise<void> {
    await expect(this.routeHost).toBeVisible();
    await expect(this.listTable).toBeVisible();
  }

}
