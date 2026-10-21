// spec: specs/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

type Employee = { kaNlTercero: number; nNit: number | string; scNombre: string };
type HistoryRow = { kaNlDato: number; kaNlEmpleado: number };
type Detail = {
  kaNlPermiso: number; kaNlEmpleado: number; ddDesde: string; ddHasta: string;
  scDescripcion: string; ndActoAdministrativo: number | string | null;
  ddActoAdministrativo: string | null; scCompensatorio: string; scPermiso: string; aprobada: string;
};

test.describe("New form, flags and required validation", () => {
  test("PER-015 New resets details and preserves employee", async ({ page }) => {
    const permissions = new PermissionsPage(page);
    const api = "/api/v1/w-vacaciones-licencias-ascensos-permisos";
    const mutations: string[] = [];
    page.on("request", request => {
      if (new URL(request.url()).pathname.startsWith(api + "/") &&
          !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
        mutations.push(request.method() + " " + request.url());
      }
    });
    const displayDate = (value: string | null) =>
      value === null ? "" : value.split("-").reverse().join("/");

    // 1. Start a fresh authenticated context, select the supplied employee and inspect an existing record.
    await permissions.goto();
    await expect(page).toHaveURL(/\/permisos$/);
    await expect(permissions.heading).toBeVisible();
    await expect(permissions.employeeDocumentInput).toHaveValue("");
    await expect(permissions.employeeSearchButton).toBeEnabled();
    await expect(permissions.historyRows).toHaveCount(0);
    const document = "43433798";
    const employeeWait = page.waitForResponse(response =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === api + "/empleados/by-nitsd/" + document);
    const historyWait = page.waitForResponse(response =>
      response.request().method() === "GET" && new URL(response.url()).pathname === api + "/rows");
    await permissions.employeeDocumentInput.fill(document);
    await permissions.employeeSearchButton.click();
    const employeeResponse = await employeeWait;
    expect(employeeResponse.status(), "Prerequisite: supplied employee must exist").toBe(200);
    const employee: Employee = await employeeResponse.json();
    expect(String(employee.nNit)).toBe(document);
    const historyResponse = await historyWait;
    expect(historyResponse.status()).toBe(200);
    const historyUrl = new URL(historyResponse.url());
    expect(historyUrl.searchParams.get("kaNlTercero")).toBe(String(employee.kaNlTercero));
    expect(historyUrl.searchParams.get("limit")).toBe("200");
    expect(historyUrl.searchParams.get("calamidad")).toBe("N");
    const history: HistoryRow[] = await historyResponse.json();
    expect(history.length, "Prerequisite: employee must have an existing permission").toBeGreaterThan(0);
    for (const row of history) expect(row.kaNlEmpleado).toBe(employee.kaNlTercero);
    await expect(permissions.historyRows).toHaveCount(history.length);
    const selectedRow = permissions.historyVisibleRows.first();
    await expect(selectedRow).toBeVisible();
    const selectedId = await selectedRow.getAttribute("data-testid");
    const selected = history.find(row => selectedId === "permisos-table-row--" + row.kaNlDato);
    if (!selected) throw new Error("Prerequisite: visible record must match runtime history");
    const detailWait = page.waitForResponse(response =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === api + "/rows/" + selected.kaNlDato);
    await selectedRow.click();
    const detailResponse = await detailWait;
    expect(detailResponse.status()).toBe(200);
    const detail: Detail = await detailResponse.json();
    expect(detail.kaNlPermiso).toBe(selected.kaNlDato);
    expect(detail.kaNlEmpleado).toBe(employee.kaNlTercero);
    await expect(selectedRow).toHaveClass(/\bselected\b/);
    await expect(permissions.startDateInput).toHaveValue(displayDate(detail.ddDesde));
    await expect(permissions.endDateInput).toHaveValue(displayDate(detail.ddHasta));
    await expect(permissions.descriptionInput).toHaveValue(detail.scDescripcion);
    await expect(permissions.administrativeActInput).toHaveValue(String(detail.ndActoAdministrativo ?? ""));
    await expect(permissions.administrativeActDateInput).toHaveValue(displayDate(detail.ddActoAdministrativo));
    const flags = [
      [permissions.compensatoryYesCheckbox, permissions.compensatoryNoCheckbox, detail.scCompensatorio, false],
      [permissions.permissionYesCheckbox, permissions.permissionNoCheckbox, detail.scPermiso, true],
      [permissions.approvedYesCheckbox, permissions.approvedNoCheckbox, detail.aprobada, false],
    ] as const;
    for (const [yes, no, flag] of flags) {
      expect(["S", "N"]).toContain(flag);
      await expect(yes).toBeChecked({ checked: flag === "S" });
      await expect(no).toBeChecked({ checked: flag === "N" });
    }
    const historyBefore = await permissions.historyRows.allTextContents();
    const rowIdsBefore = await permissions.historyRows.evaluateAll(rows =>
      rows.map(row => row.getAttribute("data-testid")));
    const assertReset = async (today: string) => {
      for (const input of [permissions.startDateInput, permissions.endDateInput,
        permissions.administrativeActDateInput]) await expect(input).toHaveValue(today);
      await expect(permissions.descriptionInput).toHaveValue("");
      await expect(permissions.administrativeActInput).toHaveValue("");
      for (const [yes, no, , defaultYes] of flags) {
        await expect(yes).toBeEnabled();
        await expect(no).toBeEnabled();
        await expect(yes).toBeChecked({ checked: defaultYes });
        await expect(no).toBeChecked({ checked: !defaultYes });
      }
      await expect(permissions.newButton).toBeEnabled();
      await expect(permissions.saveButton).toBeEnabled();
      await expect(permissions.deleteButton).toBeDisabled();
      await expect(permissions.historyTable.locator("tr.selected")).toHaveCount(0);
      await expect(permissions.employeeDocumentInput).toHaveValue(document);
      await expect(permissions.employeeNameValue).toHaveText(employee.scNombre);
      await expect(permissions.historyRows).toHaveText(historyBefore);
      expect(await permissions.historyRows.evaluateAll(rows =>
        rows.map(row => row.getAttribute("data-testid")))).toEqual(rowIdsBefore);
      await expect(permissions.historyEmptyState).toBeHidden();
    };

    // 2. Click New and inspect current-day dates, empty text fields and all native flag defaults.
    const today = await permissions.startDateInput.evaluate(() => new Date().toLocaleDateString("en-GB"));
    await permissions.newButton.click();
    await assertReset(today);

    // 3. Type an unsaved description/act and click New again without Save.
    await permissions.descriptionInput.fill("PER-015 unsaved draft");
    await permissions.administrativeActInput.fill("123");
    await expect(permissions.descriptionInput).toHaveValue("PER-015 unsaved draft");
    await expect(permissions.administrativeActInput).toHaveValue("123");
    const resetDay = await permissions.startDateInput.evaluate(() => new Date().toLocaleDateString("en-GB"));
    await permissions.newButton.click();

    // 4. Verify the draft resets again while employee identity and existing history remain intact.
    await assertReset(resetDay);

    // 5. Verify no error/reset confirmation or permission record mutation occurred.
    await expect(page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "Error", exact: true }),
    })).toBeHidden();
    await expect(page.getByRole("alertdialog")).toBeHidden();
    // The selector's mounted Side sheets dialog is unrelated to New.
    await expect(page.getByRole("dialog").filter({ visible: true })
      .filter({ hasNot: page.getByRole("heading", { name: "Seleccionar Empleado", exact: true }) }))
      .toHaveCount(0);
    expect(mutations, "Resetting an unsaved draft must not mutate permission records").toEqual([]);
  });
});

