// spec: specs/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

type Employee = { kaNlTercero: number; nNit: string | number; scNombre: string };
type HistoryRow = { kaNlDato: number; kaNlEmpleado: number; [key: string]: unknown };

test.describe("Dates, description and numeric boundaries", () => {
  test.use({ baseURL: "https://nomina-qa.adacsc.co/" });

  test("PER-023 — Malformed and impossible dates", async ({ page, baseURL }) => {
    test.setTimeout(60_000);
    const permissions = new PermissionsPage(page);
    const api = "/api/v1/w-vacaciones-licencias-ascensos-permisos";
    const requests: string[] = [];
    const mutations: string[] = [];
    const blockedPayloads: Record<string, unknown>[] = [];
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
        blockedPayloads.push(route.request().postDataJSON());
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
    // 2. Independently enter impossible and malformed values in each date field and blur.
    const cases = [
      { name: "start", field: permissions.startDateInput, error: "Debe ingresar la Fecha Desde.", optional: false },
      { name: "end", field: permissions.endDateInput, error: "Debe ingresar la Fecha Hasta.", optional: false },
      { name: "act", field: permissions.administrativeActDateInput, error: "Ocurrio un error en la operacion solicitada.", optional: true },
    ];
    for (const scenario of cases) {
      // Empty is an additional control for the optional act date.
      for (const invalid of scenario.optional ? ["31/02/2026", "not-a-date", ""] : ["31/02/2026", "not-a-date"]) {
        await test.step(scenario.name + " date: " + (invalid || "empty control"), async () => {
          await permissions.newButton.click();
          await permissions.startDateInput.fill(draftDate);
          await permissions.startDateInput.press("Tab");
          await permissions.endDateInput.fill(draftDate);
          await permissions.endDateInput.press("Tab");
          await permissions.descriptionInput.fill("PER-023 invalid date");
          await permissions.administrativeActInput.fill("1");
          await permissions.administrativeActDateInput.fill(today);
          await permissions.administrativeActDateInput.press("Tab");
          await expect(permissions.compensatoryNoCheckbox).toBeChecked();
          await expect(permissions.permissionYesCheckbox).toBeChecked();
          await expect(permissions.approvedNoCheckbox).toBeChecked();
          await scenario.field.fill(invalid);
          await scenario.field.press("Tab");
          const normalized = scenario.optional && invalid === "31/02/2026" ? invalid : "";
          await expect(scenario.field).toHaveValue(normalized);
          await expect(permissions.view.locator("mat-error")).toHaveCount(0);

          // 3. Attempt Save only with persistence blocked; assert exact title/body before dismissal.
          const beforeSave = requests.length;
          const beforeBlocked = blockedPayloads.length;
          await expect(permissions.saveButton).toBeEnabled();
          await permissions.saveButton.click();
          await expect(errorDialog).toBeVisible();
          await expect(errorDialog.getByRole("heading", { level: 2 })).toHaveText("Error");
          await expect(errorDialog.getByText(scenario.error, { exact: true })).toBeVisible();
          if (scenario.optional) {
            // This error follows our deliberate network abort, not backend validation.
            expect(blockedPayloads).toHaveLength(beforeBlocked + 1);
            const payload = blockedPayloads[beforeBlocked];
            expect(payload.kaNlEmpleado).toBe(employee.kaNlTercero);
            expect(payload.ddActoAdministrativo).toBeNull();
            expect(payload.scDescripcion).toBe("PER-023 invalid date");
            expect(mutations).toHaveLength(beforeBlocked + 1);
            expect(mutations[beforeBlocked]).toMatch(/^POST /);
            expect(requests.slice(beforeSave)).toEqual([mutations[beforeBlocked]]);
          } else {
            expect(blockedPayloads).toHaveLength(beforeBlocked);
            expect(requests.slice(beforeSave), "Required invalid dates validate locally").toEqual([]);
          }
          await errorDialog.getByTestId("permisos-dialog-error-confirm-button").click();
          await expect(errorDialog).toBeHidden();
          await expect(permissions.historyRows).toHaveCount(history.length);
          if (history.length) await expect(permissions.historyRows).toHaveText(historyBefore);
        });
      }
    }

    // 4. Assert final UI and network results, then reload and read back unchanged history.
    await expect(permissions.administrativeActDateInput).toHaveValue("");
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
    expect(blockedPayloads, "All three optional act-date Save attempts were blocked").toHaveLength(3);
    expect(mutations).toHaveLength(3);
  });
});




