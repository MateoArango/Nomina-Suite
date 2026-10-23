// spec: specs/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

type Employee = { kaNlTercero: number; nNit: string | number; scNombre: string };
type HistoryRow = { kaNlDato: number; kaNlEmpleado: number; [key: string]: unknown };

test.describe("New form, flags and required validation", () => {
  test.use({ baseURL: "https://nomina-qa.adacsc.co/" });

  test("PER-021 — Missing-field validation order", async ({ page, baseURL }) => {
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
    // Prevent an unexpected acceptance from persisting data in shared QA.
    await page.route("**/api/v1/w-vacaciones-licencias-ascensos-permisos/**", async route => {
      if (["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
        await route.continue();
      } else {
        await route.abort("blockedbyclient");
      }
    });
    const errorDialog = page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "Error", exact: true }),
    });

    // 1. Start a fresh authenticated context, search directly for document 43442343 and click New.
    await permissions.goto(baseURL);
    await expect(page).toHaveURL(/\/permisos$/);
    await expect(permissions.heading).toBeVisible();
    await expect(permissions.employeeDocumentInput).toHaveValue("");
    await expect(permissions.employeeSearchButton).toBeEnabled();
    await expect(permissions.historyRows).toHaveCount(0);
    const employeeDocument = "43442343";
    const searchEmployee = async () => {
      const employeeWait = page.waitForResponse(response =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname === api + "/empleados/by-nitsd/" + employeeDocument);
      const historyWait = page.waitForResponse(response => {
        const url = new URL(response.url());
        return response.request().method() === "GET" && url.pathname === api + "/rows" &&
          url.searchParams.get("limit") === "200" && url.searchParams.get("calamidad") === "N";
      });
      await permissions.employeeDocumentInput.fill(employeeDocument);
      await permissions.employeeSearchButton.click();
      const [employeeResponse, historyResponse] = await Promise.all([employeeWait, historyWait]);
      expect(employeeResponse.status()).toBe(200);
      const employee: Employee = await employeeResponse.json();
      expect(String(employee.nNit)).toBe(employeeDocument);
      expect(new URL(historyResponse.url()).searchParams.get("kaNlTercero"))
        .toBe(String(employee.kaNlTercero));
      await expect(permissions.employeeSelectorTable).toBeHidden();
      return { employee, historyResponse };
    };
    const { employee, historyResponse } = await searchEmployee();
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
    // 2. Clear every required date/text/act input, including auto-filled dates.
    const fields = [
      permissions.startDateInput,
      permissions.endDateInput,
      permissions.descriptionInput,
      permissions.administrativeActInput,
    ];
    for (const field of fields) {
      await field.fill("");
      await field.press("Tab");
      await expect(field).toHaveValue("");
    }
    await expect(permissions.compensatoryNoCheckbox).toBeChecked();
    await expect(permissions.permissionYesCheckbox).toBeChecked();
    await expect(permissions.approvedNoCheckbox).toBeChecked();

    // 3. Verify the runtime-observed order; fill only the reported field after each rejection.
    const validations = [
      { body: "Debe ingresar la Fecha Desde.", value: draftDate },
      { body: "Debe ingresar la Fecha Hasta.", value: draftDate },
      { body: "Debe ingresar la Descripcion.", value: "PER-021 validation order" },
      { body: "Debe ingresar el Acto Administrativo.", value: "1" },
    ];
    for (let index = 0; index < validations.length; index++) {
      await test.step("Required-field rejection " + (index + 1), async () => {
        for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
          await expect(fields[fieldIndex]).toHaveValue(
            fieldIndex < index ? validations[fieldIndex].value : "",
          );
        }
        await expect(permissions.saveButton).toBeEnabled();
        const beforeSave = requests.length;
        await permissions.saveButton.click();
        await expect(errorDialog).toBeVisible();
        await expect(errorDialog.getByRole("heading", { level: 2 })).toHaveText("Error");
        await expect(errorDialog.getByText(validations[index].body, { exact: true })).toBeVisible();
        for (let other = 0; other < validations.length; other++) {
          if (other !== index) {
            await expect(errorDialog.getByText(validations[other].body, { exact: true })).toBeHidden();
          }
        }
        expect(requests.slice(beforeSave), "Required-field validation stays local").toEqual([]);
        await errorDialog.getByTestId("permisos-dialog-error-confirm-button").click();
        await expect(errorDialog).toBeHidden();
        await fields[index].fill(validations[index].value);
        await fields[index].press("Tab");
        await expect(fields[index]).toHaveValue(validations[index].value);
      });
    }
    // All required fields are now populated. Do not perform a valid final Save.
    for (let index = 0; index < fields.length; index++) {
      await expect(fields[index]).toHaveValue(validations[index].value);
    }

    // 4. Assert final UI and network results, then reload and read back unchanged history.
    await expect(permissions.administrativeActInput).toHaveValue("1");
    await expect(permissions.startDateInput).toHaveValue(draftDate);
    await expect(permissions.saveButton).toBeEnabled();
    await expect(permissions.deleteButton).toBeDisabled();
    await expect(permissions.historyRows).toHaveCount(history.length);
    if (history.length) await expect(permissions.historyRows).toHaveText(historyBefore);
    await page.reload();
    await expect(permissions.heading).toBeVisible();
    const { employee: reloadedEmployee, historyResponse: readback } = await searchEmployee();
    expect(reloadedEmployee.kaNlTercero).toBe(employee.kaNlTercero);
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
    expect(mutations, "Rejected required-field Saves must never mutate permission records").toEqual([]);
  });
});




