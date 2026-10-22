// spec: specs/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

type Employee = { kaNlTercero: number; nNit: string | number; scNombre: string };
type HistoryRow = { kaNlDato: number; kaNlEmpleado: number; [key: string]: unknown };

test.describe("New form, flags and required validation", () => {
  test("PER-017 — Start date is required", async ({ page }) => {
    const permissions = new PermissionsPage(page);
    const api = "/api/v1/w-vacaciones-licencias-ascensos-permisos";
    const requests: string[] = [];
    const mutations: string[] = [];
    page.on("request", request => {
      if (!new URL(request.url()).pathname.startsWith(api + "/")) return;
      requests.push(request.method() + " " + request.url());
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
        mutations.push(request.method() + " " + request.url());
      }
    });
    const errorDialog = page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "Error", exact: true }),
    });

    // 1. Start a fresh authenticated context, select an existing employee and click New.
    await permissions.goto();
    await expect(page).toHaveURL(/\/permisos$/);
    await expect(permissions.heading).toBeVisible();
    await expect(permissions.employeeDocumentInput).toHaveValue("");
    await expect(permissions.employeeSearchButton).toBeEnabled();
    await expect(permissions.historyRows).toHaveCount(0);
    const lookupWait = page.waitForResponse(response =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === api + "/lookups/empleados" &&
      new URL(response.url()).searchParams.get("limit") === "2000");
    await permissions.employeeSelectorOpenButton.click();
    const lookup = await lookupWait;
    expect(lookup.status()).toBe(200);
    const employees: Employee[] = await lookup.json();
    expect(employees.length, "Prerequisite: an existing employee is required").toBeGreaterThan(0);
    const firstRow = permissions.employeeSelectorVisibleRows.first();
    await expect(firstRow).toBeVisible();
    const rowId = await firstRow.getAttribute("data-testid");
    const employee = employees.find(item =>
      rowId === "permisos-employee-selector-row--" + item.kaNlTercero);
    if (!employee) throw new Error("Prerequisite: visible employee must match runtime lookup");
    const waitForHistory = () => page.waitForResponse(response => {
      const url = new URL(response.url());
      return response.request().method() === "GET" && url.pathname === api + "/rows" &&
        url.searchParams.get("kaNlTercero") === String(employee.kaNlTercero) &&
        url.searchParams.get("limit") === "200" && url.searchParams.get("calamidad") === "N";
    });
    const historyWait = waitForHistory();
    await firstRow.dblclick();
    const historyResponse = await historyWait;
    expect(historyResponse.status()).toBe(200);
    const history: HistoryRow[] = await historyResponse.json();
    for (const row of history) expect(row.kaNlEmpleado).toBe(employee.kaNlTercero);
    await expect(permissions.historyRows).toHaveCount(history.length);
    await expect(permissions.employeeDocumentInput).toHaveValue(String(employee.nNit));
    await expect(permissions.employeeNameValue).toHaveText(employee.scNombre);
    await permissions.newButton.click();
    const historyBefore = await permissions.historyRows.allTextContents();

    // Select a day beyond every runtime history date so no existing range can overlap.
    const today = await permissions.startDateInput.inputValue();
    expect(today).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    const [day, month, year] = today.split("/").map(Number);
    let latest = Date.UTC(year, month - 1, day);
    for (const row of history) {
      for (const value of Object.values(row)) {
        if (typeof value !== "string") continue;
        const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(value);
        const local = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
        if (iso) latest = Math.max(latest, Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
        if (local) latest = Math.max(latest, Date.UTC(+local[3], +local[2] - 1, +local[1]));
      }
    }
    const date = new Date(latest + 86400000);
    const draftDate = [String(date.getUTCDate()).padStart(2, "0"),
      String(date.getUTCMonth() + 1).padStart(2, "0"), date.getUTCFullYear()].join("/");
    await permissions.startDateInput.fill(draftDate);
    await permissions.startDateInput.press("Tab");
    await permissions.endDateInput.fill(draftDate);
    await permissions.endDateInput.press("Tab");
    await permissions.descriptionInput.fill("PER-017 required start date");
    await permissions.administrativeActInput.fill("1");
    await permissions.administrativeActDateInput.fill(today);
    await permissions.administrativeActDateInput.press("Tab");
    await expect(permissions.compensatoryNoCheckbox).toBeChecked();
    await expect(permissions.permissionYesCheckbox).toBeChecked();
    await expect(permissions.approvedNoCheckbox).toBeChecked();

    // 2. Fill every other required value correctly; clear only start date and blur.
    await permissions.startDateInput.fill("");
    await permissions.startDateInput.press("Tab");
    await expect(permissions.startDateInput).toHaveValue("");
    await expect(permissions.endDateInput).toHaveValue(draftDate);
    await expect(permissions.descriptionInput).toHaveValue("PER-017 required start date");
    await expect(permissions.administrativeActInput).toHaveValue("1");
    await expect(permissions.administrativeActDateInput).toHaveValue(today);

    // 3. Click Save; assert the exact runtime error before dismissing.
    await expect(permissions.saveButton).toBeEnabled();
    const beforeSave = requests.length;
    await permissions.saveButton.click();
    await expect(errorDialog).toBeVisible();
    await expect(errorDialog.getByRole("heading", { level: 2 })).toHaveText("Error");
    await expect(errorDialog.getByText("Debe ingresar la Fecha Desde.", { exact: true })).toBeVisible();
    expect(requests.slice(beforeSave), "Required start date validates locally").toEqual([]);
    await errorDialog.getByTestId("permisos-dialog-error-confirm-button").click();
    await expect(errorDialog).toBeHidden();

    // 4. Assert final UI and network results, then reload and read back unchanged history.
    await expect(permissions.startDateInput).toHaveValue("");
    await expect(permissions.endDateInput).toHaveValue(draftDate);
    await expect(permissions.saveButton).toBeEnabled();
    await expect(permissions.deleteButton).toBeDisabled();
    await expect(permissions.historyRows).toHaveCount(history.length);
    if (history.length) await expect(permissions.historyRows).toHaveText(historyBefore);
    await page.reload();
    await expect(permissions.heading).toBeVisible();
    await permissions.employeeDocumentInput.fill(String(employee.nNit));
    const readbackWait = waitForHistory();
    await permissions.employeeSearchButton.click();
    const readback = await readbackWait;
    expect(readback.status()).toBe(200);
    expect(await readback.json(), "Rejected Save must preserve complete history").toEqual(history);
    await expect(permissions.employeeNameValue).toHaveText(employee.scNombre);
    await expect(permissions.historyRows).toHaveCount(history.length);
    if (history.length) await expect(permissions.historyRows).toHaveText(historyBefore);

    // 5. Verify the app remains usable and no permission record was persisted.
    await expect(permissions.employeeSearchButton).toBeEnabled();
    await expect(permissions.newButton).toBeEnabled();
    await permissions.newButton.click();
    await expect(permissions.saveButton).toBeEnabled();
    await expect(permissions.deleteButton).toBeDisabled();
    await expect(errorDialog).toBeHidden();
    expect(mutations, "Missing start date must never mutate permission records").toEqual([]);
  });
});
