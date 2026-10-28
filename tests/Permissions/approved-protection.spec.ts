// spec: specs/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

type HistoryRow = {
  kaNlDato: number; kaNlEmpleado: number; nNit: number | string; scNombre: string;
  aprobada: string; ddDesde: string; ddHasta: string; scDescripcion: string;
  scCompensatorio: string; scPermiso: string;
};
type Detail = {
  kaNlPermiso: number; kaNlEmpleado: number; aprobada: string;
  ddDesde: string; ddHasta: string; scDescripcion: string;
  scCompensatorio: string; scPermiso: string;
  ndActoAdministrativo: number | string | null; ddActoAdministrativo: string | null;
};

test.describe("Persistence and approved protection", () => {
  test("PER-033 — Approved existing record cannot be saved or deleted", async ({ page }, testInfo) => {
    const permissions = new PermissionsPage(page);
    const api = "/api/v1/w-vacaciones-licencias-ascensos-permisos";
    const document = "70324693";
    const mutations: string[] = [];
    page.on("request", request => {
      if (new URL(request.url()).pathname.startsWith(api + "/") &&
          !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
        mutations.push(request.method() + " " + request.url());
      }
    });
    const date = (value: string | null) => value ? value.split("-").reverse().join("/") : "";
    const search = async () => {
      const employeeWait = page.waitForResponse(r => r.request().method() === "GET" &&
        new URL(r.url()).pathname === api + "/empleados/by-nitsd/" + document);
      const historyWait = page.waitForResponse(r => r.request().method() === "GET" &&
        new URL(r.url()).pathname === api + "/rows");
      await permissions.employeeDocumentInput.fill(document);
      await permissions.employeeSearchButton.click();
      const employeeResponse = await employeeWait;
      expect(employeeResponse.status(), "Prerequisite: supplied employee exists").toBe(200);
      const employee: { kaNlTercero: number; nNit: number | string; scNombre: string } = await employeeResponse.json();
      expect(String(employee.nNit)).toBe(document);
      const historyResponse = await historyWait;
      expect(historyResponse.status()).toBe(200);
      expect(new URL(historyResponse.url()).searchParams.get("kaNlTercero")).toBe(String(employee.kaNlTercero));
      const history: HistoryRow[] = await historyResponse.json();
      expect(Array.isArray(history)).toBe(true);
      await expect(permissions.employeeDocumentInput).toHaveValue(document);
      await expect(permissions.employeeNameValue).toHaveText(employee.scNombre);
      return { employee, history };
    };
    const select = async (row: HistoryRow) => {
      // Pagination keeps off-page rows mounted; reveal the discovered runtime row.
      while (!(await permissions.historyRow(row.kaNlDato).isVisible())) {
        expect(await permissions.historyNextPageButton.isEnabled(),
          "Prerequisite: approved runtime row must be reachable").toBe(true);
        await permissions.historyNextPageButton.click();
      }
      const detailWait = page.waitForResponse(r => r.request().method() === "GET" &&
        new URL(r.url()).pathname === api + "/rows/" + row.kaNlDato);
      await permissions.historyRow(row.kaNlDato).click();
      const response = await detailWait;
      expect(response.status()).toBe(200);
      const detail: Detail = await response.json();
      expect(detail.kaNlPermiso).toBe(row.kaNlDato);
      expect(detail.kaNlEmpleado).toBe(row.kaNlEmpleado);
      for (const field of ["aprobada", "ddDesde", "ddHasta", "scDescripcion", "scCompensatorio", "scPermiso"] as const) {
        expect(detail[field]).toBe(row[field]);
      }
      await expect(permissions.historyRow(row.kaNlDato)).toHaveClass(/\bselected\b/);
      const indicator = permissions.historyRow(row.kaNlDato).getByRole("cell").nth(0).locator('input[type="checkbox"]');
      await expect(indicator).toBeChecked();
      await expect(indicator).toBeDisabled();
      return detail;
    };
    const verifyProtection = async (detail: Detail) => {
      expect(detail.aprobada).toBe("S");
      await expect(permissions.saveButton).toBeDisabled();
      await expect(permissions.deleteButton).toBeDisabled();
      await expect(permissions.newButton).toBeEnabled();
      // Discovery discrepancy: these five inputs remain enabled on approved records.
      for (const [input, value] of [
        [permissions.startDateInput, date(detail.ddDesde)],
        [permissions.endDateInput, date(detail.ddHasta)],
        [permissions.descriptionInput, detail.scDescripcion],
        [permissions.administrativeActInput, String(detail.ndActoAdministrativo ?? "")],
        [permissions.administrativeActDateInput, date(detail.ddActoAdministrativo)],
      ] as const) {
        await expect(input).toBeEnabled();
        await expect(input).toHaveValue(value);
      }
      for (const [yes, no, flag] of [
        [permissions.compensatoryYesCheckbox, permissions.compensatoryNoCheckbox, detail.scCompensatorio],
        [permissions.permissionYesCheckbox, permissions.permissionNoCheckbox, detail.scPermiso],
        [permissions.approvedYesCheckbox, permissions.approvedNoCheckbox, detail.aprobada],
      ] as const) {
        expect(["S", "N"]).toContain(flag);
        await expect(yes).toBeDisabled();
        await expect(no).toBeDisabled();
        await expect(yes).toBeChecked({ checked: flag === "S" });
        await expect(no).toBeChecked({ checked: flag === "N" });
      }
    };

    // 1. Start a fresh authenticated context and discover an existing approved row for the supplied employee.
    await permissions.goto();
    await expect(page).toHaveURL(/\/permisos$/);
    await expect(permissions.heading).toBeVisible();
    await expect(permissions.employeeDocumentInput).toHaveValue("");
    await expect(permissions.employeeSearchButton).toBeEnabled();
    await expect(permissions.historyRows).toHaveCount(0);
    const baseline = await search();
    const approved = baseline.history.find(row => row.aprobada === "S");
    expect(approved, "Prerequisite: employee 70324693 must have an existing approved permission").toBeDefined();
    if (!approved) throw new Error("Missing prerequisite: existing approved permission for employee 70324693");
    expect(approved.kaNlEmpleado).toBe(baseline.employee.kaNlTercero);
    expect(String(approved.nNit)).toBe(document);

    // 2. Select the runtime approved row and inspect detail response and flags.
    const detail = await select(approved);

    // 3. Assert Save/Delete and flags disabled; inspect actual input states without saving.
    await verifyProtection(detail);
    await testInfo.attach("approved-input-state-discrepancy", {
      body: "Approved record: Save/Delete and six flag checkboxes disabled; start/end dates, description, administrative act number/date remain enabled. No edit or save attempted.",
      contentType: "text/plain",
    });

    // 4. Reload, search the same employee and reselect the same persisted record.
    await page.reload();
    await expect(permissions.heading).toBeVisible();
    await expect(permissions.employeeDocumentInput).toHaveValue("");
    const reloaded = await search();
    expect(reloaded.employee).toEqual(baseline.employee);
    expect(reloaded.history).toEqual(baseline.history);
    const persisted = reloaded.history.find(row => row.kaNlDato === approved.kaNlDato);
    expect(persisted, "The same approved record must persist after reload").toEqual(approved);
    const reloadedDetail = await select(approved);
    expect(reloadedDetail).toEqual(detail);

    // 5. Assert final protection, available New action and unchanged persisted values.
    await verifyProtection(reloadedDetail);

    // 6. Disabled actions require no error modal; never force-click or mutate the approved record.
    await expect(page.getByRole("dialog").filter({
      hasNot: page.getByTestId("permisos-employee-selector-close-button"),
    })).toBeHidden();
    await expect(page.getByRole("alertdialog")).toBeHidden();
    expect(mutations, "Read-only protection inspection must not mutate permission records").toEqual([]);
  });
});
