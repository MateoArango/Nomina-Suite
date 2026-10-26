// spec: specs/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";


test.describe("Dates, description and numeric boundaries", () => {
  test.use({ baseURL: "https://nomina-qa.adacsc.co/" });
  test("PER-024 — Description accepts exactly 200 characters", async ({ browser, page: authenticatedPage, baseURL }) => {
    test.setTimeout(90_000);
    await new PermissionsPage(authenticatedPage).goto(baseURL);
    // Reuse fixture authentication in independent contexts; this app also stores session state.
    const storageState = await authenticatedPage.context().storageState();
    const sessionState = await authenticatedPage.locator("html").evaluate(() => ({ ...sessionStorage }));
    for (const length of [199, 200]) {
      const context = await browser.newContext({ baseURL, storageState });
      await context.addInitScript(state => {
        for (const [key, value] of Object.entries(state)) sessionStorage.setItem(key, value);
      }, sessionState);
      const page = await context.newPage();
      try {
        const permissions = new PermissionsPage(page);
        const api = "/api/v1/w-vacaciones-licencias-ascensos-permisos";
        type Row = { kaNlDato: number; kaNlEmpleado: number; ddDesde: string; ddHasta: string; scDescripcion: string };
        let ownedId: number | undefined;
        let historyUrl = "";
        let requestHeaders: Record<string, string> = {};
        const description = (`PER-024-${length}-`).padEnd(length, "X");
        const search = async () => {
          const employeeWait = page.waitForResponse(r => r.request().method() === "GET" &&
            r.url().endsWith(api + "/empleados/by-nitsd/70852942"));
          const historyWait = page.waitForResponse(r => r.request().method() === "GET" && r.url().includes(api + "/rows?"));
          await permissions.employeeDocumentInput.fill("70852942");
          await permissions.employeeSearchButton.click();
          const [employeeResponse, historyResponse] = await Promise.all([employeeWait, historyWait]);
          expect(employeeResponse.status()).toBe(200);
          expect(historyResponse.status()).toBe(200);
          const employee = await employeeResponse.json();
          const query = new URL(historyResponse.url()).searchParams;
          expect(query.get("kaNlTercero")).toBe(String(employee.kaNlTercero));
          expect(query.get("limit")).toBe("200");
          expect(query.get("calamidad")).toBe("N");
          expect(String(employee.nNit)).toBe("70852942");
          await expect(permissions.employeeNameValue).toHaveText(employee.scNombre);
          historyUrl = historyResponse.url();
          const history: Row[] = await historyResponse.json();
          for (const row of history) expect(row.kaNlEmpleado).toBe(employee.kaNlTercero);
          await expect(permissions.historyRows).toHaveCount(history.length);
          return { employee, history };
        };
        const reload = async () => {
          await page.reload();
          await expect(permissions.heading).toBeVisible();
          return search();
        };

        // 1. Start fresh, capture runtime identity/history and prepare an unused unapproved range.
        await permissions.goto(baseURL);
        await expect(page).toHaveURL(/\/permisos$/);
        await expect(permissions.heading).toBeVisible();
        await expect(permissions.employeeDocumentInput).toHaveValue("");
        const { employee, history: original } = await search();
        await permissions.newButton.click();
        const [day, month, year] = (await permissions.startDateInput.inputValue()).split("/").map(Number);
        const latest = Math.max(Date.UTC(year, month - 1, day),
          ...original.map(row => Date.parse(row.ddHasta)));
        const iso = new Date(latest + 86400000).toISOString().slice(0, 10);
        const date = iso.split("-").reverse().join("/");
        for (const input of [permissions.startDateInput, permissions.endDateInput]) {
          await input.fill(date);
          await input.press("Tab");
          await expect(input).toHaveValue(date);
        }
        // 2. Generate deterministic ASCII boundary data and verify the complete DOM value.
        await permissions.descriptionInput.fill(description);
        await expect(permissions.descriptionInput).toHaveValue(description);
        expect((await permissions.descriptionInput.inputValue()).length).toBe(length);
        await permissions.administrativeActInput.fill("1");
        await expect(permissions.approvedNoCheckbox).toBeChecked();
        await expect(permissions.compensatoryNoCheckbox).toBeChecked();
        await expect(permissions.permissionYesCheckbox).toBeChecked();
        try {
          // 3. Save once without intercepting or blocking the real create request.
          await permissions.administrativeActDateInput.fill(date);
          await permissions.administrativeActDateInput.press("Tab");
          await expect(permissions.administrativeActDateInput).toHaveValue(date);
          const createWait = page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith(api + "/rows"));
          await permissions.saveButton.click();
          const created = await createWait;
          const result = await created.json();
          // Retain ownership before assertions so finally can clean up an accepted create.
          ownedId = result.detail?.kaNlPermiso;
          requestHeaders = { authorization: (await created.request().allHeaders()).authorization };
          const payload = created.request().postDataJSON();
          await test.info().attach(`create-contract-${length}`, { body: JSON.stringify({
            method: created.request().method(), url: created.url(), payload, status: created.status(), response: result,
          }, null, 2), contentType: "application/json" });
          expect(created.status(), "Backend must accept the description boundary unchanged").toBe(201);
          expect(ownedId).toEqual(expect.any(Number));
          expect(original.some(row => row.kaNlDato === ownedId)).toBe(false);
          expect(payload).toMatchObject({ kaNlPermiso: null, kaNlEmpleado: employee.kaNlTercero,
            ddDesde: iso, ddHasta: iso, scDescripcion: description, ndActoAdministrativo: 1,
            ddActoAdministrativo: iso, aprobada: "N", scCompensatorio: "N", scPermiso: "S" });
          const information = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Información", exact: true }) });
          await expect(information.getByRole("heading")).toHaveText("Información");
          await expect(information.getByText("El registro se guardó correctamente.", { exact: true })).toBeVisible();
          await information.getByRole("button", { name: "Aceptar", exact: true }).click();

          // 4. Reload and compare the complete stored description in history, API detail and UI.
          const persisted = await reload();
          expect(persisted.history.filter(row => row.kaNlDato === ownedId && row.scDescripcion === description)).toHaveLength(1);
          expect(persisted.history.filter(row => row.kaNlDato !== ownedId)).toEqual(original);
          expect(persisted.history.find(row => row.kaNlDato === ownedId)).toMatchObject({
            kaNlEmpleado: employee.kaNlTercero, ddDesde: iso, ddHasta: iso, scDescripcion: description, aprobada: "N",
          });
          const detailWait = page.waitForResponse(r => r.request().method() === "GET" && r.url().endsWith(api + "/rows/" + ownedId));
          await permissions.historyRow(ownedId!).click();
          const detailResponse = await detailWait;
          expect(detailResponse.status()).toBe(200);
          expect(await detailResponse.json()).toEqual(result.detail);
          expect(payload.scDescripcion).toBe(description);
          expect(payload.scDescripcion.length).toBe(length);
          expect(result.detail.scDescripcion).toBe(description);
          expect(result.detail.scDescripcion.length).toBe(length);
          await expect(permissions.administrativeActDateInput).toHaveValue(date);
          await expect(permissions.startDateInput).toHaveValue(date);
          await expect(permissions.endDateInput).toHaveValue(date);
          await expect(permissions.descriptionInput).toHaveValue(description);
          await expect(permissions.administrativeActInput).toHaveValue("1");
          await expect(permissions.approvedNoCheckbox).toBeChecked();

          // 5. Explicitly delete only the returned ID and verify the runtime confirmation/response.
          const deleteWait = page.waitForResponse(r => r.request().method() === "DELETE" && r.url().endsWith(api + "/rows/" + ownedId));
          await permissions.deleteButton.click();
          const confirmation = page.getByTestId("permisos-dialog-delete-confirmation");
          await expect(confirmation.getByRole("heading")).toHaveText("Atención");
          await expect(confirmation.getByText("¿Desea eliminar el registro seleccionado?", { exact: true })).toBeVisible();
          await confirmation.getByRole("button", { name: "Si", exact: true }).click();
          const deleted = await deleteWait;
          expect(deleted.status()).toBe(204);
          expect(await deleted.text()).toBe("");
          await expect(confirmation).toBeHidden();
          await expect(permissions.historyRow(ownedId!)).toHaveCount(0);

          // 6. Reload to prove deletion and unchanged unrelated history; New resets the selected form.
          const after = await reload();
          expect(after.history).toEqual(original);
          await expect(permissions.historyRow(ownedId!)).toHaveCount(0);
          await permissions.newButton.click();
          await expect(permissions.descriptionInput).toHaveValue("");
          await expect(permissions.administrativeActInput).toHaveValue("");
          await expect(permissions.approvedNoCheckbox).toBeChecked();
          await expect(permissions.saveButton).toBeEnabled();
          await expect(permissions.deleteButton).toBeDisabled();
          ownedId = undefined;
        } finally {
          // 7. Fallback cleanup is restricted to this creation and never replaces explicit deletion assertions.
          if (ownedId !== undefined) {
            const response = await page.request.get(historyUrl, { headers: requestHeaders });
            expect(response.status()).toBe(200);
            const rows: Row[] = await response.json();
            if (rows.some(row => row.kaNlDato === ownedId)) {
              const deletion = await page.request.delete(new URL(api + "/rows/" + ownedId, historyUrl).href, { headers: requestHeaders });
              expect(deletion.status()).toBe(204);
            }
            const readback = await page.request.get(historyUrl, { headers: requestHeaders });
            expect(readback.status()).toBe(200);
            expect((await readback.json() as Row[]).some(row => row.kaNlDato === ownedId)).toBe(false);
          }
        }
      } finally {
        await context.close();
      }
    }
  });
});

