// spec: specs/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

test.describe("Collision rejection across modules", () => {
  test.use({ baseURL: "https://nomina-qa.adacsc.co/" });
  test("PER-031 — Overlap with ordinary leave", async ({ page, baseURL }) => {
    const permissions = new PermissionsPage(page);
    const api = "/api/v1/w-vacaciones-licencias-ascensos-permisos";
    const message = "El empleado se encuentra en una licencia en el rango indicado.";
    const description = "PER-031 license overlap rejection";
    const mutations: string[] = [];
    page.on("request", request => {
      if (request.url().includes(api) && request.method() !== "GET")
        mutations.push(request.method() + " " + new URL(request.url()).pathname);
    });
    let licenseBase = "";
    let authHeaders: Record<string, string> = {};
    const search = async () => {
      const employeeWait = page.waitForResponse(r => r.request().method() === "GET" &&
        r.url().endsWith(api + "/empleados/by-nitsd/43433798"));
      const historyWait = page.waitForResponse(r => r.request().method() === "GET" &&
        new URL(r.url()).pathname === api + "/rows");
      await permissions.employeeDocumentInput.fill("43433798");
      await permissions.employeeSearchButton.click();
      const [employeeResponse, historyResponse] = await Promise.all([employeeWait, historyWait]);
      expect(employeeResponse.status()).toBe(200);
      expect(historyResponse.status()).toBe(200);
      const headers = await employeeResponse.request().allHeaders();
      authHeaders = { authorization: headers.authorization };
      licenseBase = employeeResponse.url().split(api)[0] + api.replace("permisos", "licencias");
      const employee = await employeeResponse.json();
      expect(String(employee.nNit)).toBe("43433798");
      const query = new URL(historyResponse.url()).searchParams;
      expect(query.get("kaNlTercero")).toBe(String(employee.kaNlTercero));
      expect(query.get("limit")).toBe("200");
      expect(query.get("calamidad")).toBe("N");
      const history: { kaNlDato: number; kaNlEmpleado: number; ddDesde: string; ddHasta: string }[] =
        await historyResponse.json();
      for (const row of history) expect(row.kaNlEmpleado).toBe(employee.kaNlTercero);
      await expect(permissions.employeeNameValue).toHaveText(employee.scNombre);
      await expect(permissions.historyRows).toHaveCount(history.length);
      return { employee, history };
    };
    const readDetail = async (id: number) => {
      const wait = page.waitForResponse(r => r.request().method() === "GET" &&
        r.url().endsWith(api + "/rows/" + id));
      await permissions.historyRow(id).click();
      const response = await wait;
      expect(response.status()).toBe(200);
      return response.json();
    };

    const readLicense = async (employeeId: number, licenseId?: number) => {
      const rowsResponse = await page.request.get(licenseBase + "/rows",
        { headers: authHeaders, params: { kaNlTercero: employeeId, limit: 200 } });
      expect(rowsResponse.status()).toBe(200);
      const rows: { kaNlDato: number; kaNlTercero: number; ddDesde: string; ddHasta: string }[] =
        await rowsResponse.json();
      for (const row of rows) expect(row.kaNlTercero).toBe(employeeId);
      const overlap = rows.find(row => row.ddDesde.slice(0, 10) <= "2025-11-18" &&
        row.ddHasta.slice(0, 10) >= "2025-11-18");
      expect(overlap, "An existing ordinary leave must cover November 18, 2025").toBeDefined();
      const id = licenseId ?? overlap!.kaNlDato;
      const detailResponse = await page.request.get(licenseBase + "/rows/" + id, { headers: authHeaders });
      expect(detailResponse.status()).toBe(200);
      const detail = await detailResponse.json();
      expect(detail).toMatchObject({ kaNlLicencia: id, kaNlTercero: employeeId });
      return { rows, detail, id };
    };

    // 1. Start fresh, search document 43433798 directly and capture an existing detail.
    await permissions.goto(baseURL);
    await expect(page).toHaveURL(/\/permisos$/);
    await expect(permissions.heading).toBeVisible();
    await expect(permissions.employeeDocumentInput).toHaveValue("");
    const { employee, history } = await search();
    expect(history.length, "Employee 43433798 must have an existing permission").toBeGreaterThan(0);
    const firstRow = permissions.historyVisibleRows.first();
    await expect(firstRow).toBeVisible();
    const id = Number((await firstRow.getAttribute("data-testid"))!.split("--")[1]);
    const row = history.find(record => record.kaNlDato === id);
    expect(row, "First visible row must belong to the fetched history").toBeDefined();
    const originalDetail = await readDetail(id);
    expect(originalDetail.kaNlEmpleado).toBe(employee.kaNlTercero);
    const date = "18/11/2025";
    const iso = "2025-11-18";
    expect(history.filter(record => record.ddDesde.slice(0, 10) <= iso &&
      record.ddHasta.slice(0, 10) >= iso), "The supplied license fixture must not overlap permission history").toEqual([]);
    const originalLicense = await readLicense(employee.kaNlTercero);
    await permissions.newButton.click();

    // 2. Use the supplied fixed one-day license overlap and fill valid remaining fields.
    for (const input of [permissions.startDateInput, permissions.endDateInput, permissions.administrativeActDateInput]) {
      await input.fill(date);
      await input.press("Tab");
      await expect(input).toHaveValue(date);
    }
    await permissions.descriptionInput.fill(description);
    await permissions.administrativeActInput.fill("1");
    await expect(permissions.compensatoryNoCheckbox).toBeChecked();
    await expect(permissions.permissionYesCheckbox).toBeChecked();
    await expect(permissions.approvedNoCheckbox).toBeChecked();
    await expect(permissions.deleteButton).toBeDisabled();

    // 3. Execute the authorized controlled negative Save and capture the underlying backend rejection.
    const responseWait = page.waitForResponse(r => r.request().method() === "POST" &&
      new URL(r.url()).pathname === api + "/rows");
    await permissions.saveButton.click();
    const response = await responseWait;
    const result = await response.json();
    const payload = response.request().postDataJSON();
    const ownedId = response.ok() ? result.detail?.kaNlPermiso : undefined;
    try {
      await test.info().attach("license-overlap-contract", {
        body: JSON.stringify({ payload, status: response.status(), response: result, existingRowId: id }, null, 2),
        contentType: "application/json",
      });
      expect(payload).toMatchObject({ kaNlPermiso: null, kaNlEmpleado: employee.kaNlTercero,
        ddDesde: iso, ddHasta: iso, ddActoAdministrativo: iso, ndActoAdministrativo: 1,
        scDescripcion: description, scCompensatorio: "N", scPermiso: "S", aprobada: "N" });
      expect(response.status()).toBe(400);
      expect(result).toMatchObject({ code: "BAD_REQUEST", message });
      const dialog = page.getByRole("dialog").filter({
        has: page.getByRole("heading", { name: "Error", exact: true }),
      });
      await expect(dialog.getByRole("heading")).toHaveText("Error");
      await expect(dialog.getByText(message, { exact: true })).toBeVisible();
      await dialog.getByTestId("permisos-dialog-error-confirm-button").click();

      // 4. Reload and compare the complete history and selected existing record with their original responses.
      await expect(permissions.descriptionInput).toHaveValue(description);
      await expect(permissions.deleteButton).toBeDisabled();
      await page.reload();
      await expect(permissions.heading).toBeVisible();
      const readback = await search();
      expect(readback.history).toEqual(history);
      expect(await readDetail(id)).toEqual(originalDetail);
      expect(await readLicense(employee.kaNlTercero, originalLicense.id)).toEqual(originalLicense);

      // 5. Verify continued usability, no remaining error and exactly one rejected permission mutation.
      await permissions.newButton.click();
      await expect(permissions.descriptionInput).toHaveValue("");
      await expect(permissions.saveButton).toBeEnabled();
      await expect(permissions.deleteButton).toBeDisabled();
      await expect(dialog).toBeHidden();
      expect(mutations).toEqual(["POST " + api + "/rows"]);
    } finally {
      // Remove only a new record returned by an unexpected acceptance; existing records are never deleted.
      if (typeof ownedId === "number") {
        expect(history.some(record => record.kaNlDato === ownedId)).toBe(false);
        const headers = await response.request().allHeaders();
        const cleanup = await page.request.delete(response.url() + "/" + ownedId,
          { headers: { authorization: headers.authorization } });
        expect(cleanup.status()).toBe(204);
        await page.reload();
        expect((await search()).history).toEqual(history);
      }
    }
  });
});





