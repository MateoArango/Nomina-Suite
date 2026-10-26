// spec: specs/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

test.describe("Dates, description and numeric boundaries", () => {
  test.use({ baseURL: "https://nomina-qa.adacsc.co/" });
  test("PER-027 — Administrative act numeric range and precision", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const permissions = new PermissionsPage(page);
    const api = "/api/v1/w-vacaciones-licencias-ascensos-permisos";
    type Row = { kaNlDato: number; kaNlEmpleado: number; ddHasta: string; scDescripcion: string };
    // Extract JSON numeric lexemes before JSON.parse can round them.
    const digitsOf = (raw: string) => {
      const match = raw.match(/"ndActoAdministrativo"\s*:\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
      expect(match, "Raw JSON must contain the administrative act numeric token").not.toBeNull();
      return match![1];
    };
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
      expect(String(employee.nNit)).toBe("70852942");
      const query = new URL(historyResponse.url()).searchParams;
      expect(query.get("kaNlTercero")).toBe(String(employee.kaNlTercero));
      expect(query.get("limit")).toBe("200");
      expect(query.get("calamidad")).toBe("N");
      await expect(permissions.employeeNameValue).toHaveText(employee.scNombre);
      const history: Row[] = await historyResponse.json();
      for (const row of history) expect(row.kaNlEmpleado).toBe(employee.kaNlTercero);
      await expect(permissions.historyRows).toHaveCount(history.length);
      return { employee, history, url: historyResponse.url(),
        headers: { authorization: (await historyResponse.request().allHeaders()).authorization } };
    };
    const reload = async () => {
      await page.reload();
      await expect(permissions.heading).toBeVisible();
      return search();
    };

    // 1. Start a fresh authenticated context; verify the Permissions page and search controls.
    await permissions.goto(baseURL);
    await expect(page).toHaveURL(/\/permisos$/);
    await expect(permissions.heading).toBeVisible();
    await expect(permissions.employeeDocumentInput).toHaveValue("");
    await expect(permissions.employeeSearchButton).toBeEnabled();
    const baseline = await search();

    // 2. Test each string independently with valid dates/description in the authorized QA fixture.
    for (const digits of ["1", "9007199254740992", "1111111111111022200", "9999999999999999999"]) {
      await test.step("Administrative act " + digits, async () => {
        await permissions.newButton.click();
        const [day, month, year] = (await permissions.startDateInput.inputValue()).split("/").map(Number);
        const latest = Math.max(Date.UTC(year, month - 1, day), ...baseline.history.map(row => Date.parse(row.ddHasta)));
        const iso = new Date(latest + 86400000).toISOString().slice(0, 10);
        const date = iso.split("-").reverse().join("/");
        for (const input of [permissions.startDateInput, permissions.endDateInput, permissions.administrativeActDateInput]) {
          await input.fill(date);
          await input.press("Tab");
          await expect(input).toHaveValue(date);
        }
        const description = "PER-027 precision " + digits;
        await permissions.descriptionInput.fill(description);
        await permissions.administrativeActInput.fill(digits);
        await permissions.administrativeActInput.press("Tab");
        await expect(permissions.administrativeActInput).toHaveValue(digits);
        await expect(permissions.compensatoryNoCheckbox).toBeChecked();
        await expect(permissions.permissionYesCheckbox).toBeChecked();
        await expect(permissions.approvedNoCheckbox).toBeChecked();
        let ownedId: number | undefined;
        try {
          // 3. Preserve original input and inspect the actual raw transmitted number digits.
          const createWait = page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith(api + "/rows"));
          await permissions.saveButton.click();
          const response = await createWait;
          const raw = await response.text();
          const result = JSON.parse(raw);
          ownedId = result.detail?.kaNlPermiso;
          const payloadRaw = response.request().postData()!;
          const transmitted = digitsOf(payloadRaw);
          await test.info().attach("numeric-contract-" + digits, {
            body: JSON.stringify({ input: digits, transmitted, payloadRaw, status: response.status(), responseRaw: raw }, null, 2),
            contentType: "application/json",
          });
          expect.soft(transmitted, "Precision loss: input " + digits + " must retain its exact digits in the request").toBe(digits);
          expect(response.request().postDataJSON()).toMatchObject({
            kaNlPermiso: null, kaNlEmpleado: baseline.employee.kaNlTercero,
            ddDesde: iso, ddHasta: iso, ddActoAdministrativo: iso, scDescripcion: description,
            scCompensatorio: "N", scPermiso: "S", aprobada: "N",
          });
          const overflow = digits === "9999999999999999999";
          expect(response.status()).toBe(overflow ? 400 : 201);

          // 4. Verify exact message title/body before dismissal; rejected values must not persist.
          const title = overflow ? "Error" : "Información";
          const dialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
          await expect(dialog.getByRole("heading")).toHaveText(title);
          if (overflow) {
            expect(result.code).toBe("BAD_REQUEST");
            expect(result.message).toMatch(new RegExp(
              "^Numeric value \\(" + transmitted + "\\) out of range of long \\(-9223372036854775808 - 9223372036854775807\\)\\n at " +
              "\\[Source: REDACTED \\(\x60StreamReadFeature.INCLUDE_SOURCE_IN_LOCATION\x60 disabled\\); line: 1, column: [0-9]+\\]$"));
            await expect(dialog.getByText(result.message.replace(/\s+/g, " "), { exact: true })).toBeVisible();
            expect(ownedId).toBeUndefined();
          } else {
            await expect(dialog.getByText("El registro se guardó correctamente.", { exact: true })).toBeVisible();
            expect(ownedId).toEqual(expect.any(Number));
            expect(baseline.history.some(row => row.kaNlDato === ownedId)).toBe(false);
            expect(digitsOf(raw)).toBe(digits);
          }
          await dialog.getByRole("button", { name: "Aceptar", exact: true }).click();
          const after = await reload();
          if (overflow) {
            expect(after.history).toEqual(baseline.history);
          } else {
            // 5. Reload and compare raw stored digits, UI value and unchanged unrelated history.
            expect(after.history.filter(row => row.kaNlDato !== ownedId)).toEqual(baseline.history);
            expect(after.history.filter(row => row.kaNlDato === ownedId && row.scDescripcion === description)).toHaveLength(1);
            const detailWait = page.waitForResponse(r => r.request().method() === "GET" && r.url().endsWith(api + "/rows/" + ownedId));
            await permissions.historyRow(ownedId!).click();
            const detail = await detailWait;
            expect(detail.status()).toBe(200);
            const storedRaw = await detail.text();
            await test.info().attach("stored-number-" + digits, { body: storedRaw, contentType: "application/json" });
            expect(digitsOf(storedRaw)).toBe(digits);
            expect(JSON.parse(storedRaw)).toEqual(result.detail);
            await expect(permissions.administrativeActInput).toHaveValue(digits);
            await expect(permissions.descriptionInput).toHaveValue(description);
          }
        } finally {
          // 6. Delete only this test's returned record ID, even when a preceding assertion fails.
          if (ownedId !== undefined) {
            expect(baseline.history.some(row => row.kaNlDato === ownedId)).toBe(false);
            const deletion = await page.request.delete(new URL(api + "/rows/" + ownedId, baseline.url).href, { headers: baseline.headers });
            expect(deletion.status()).toBe(204);
          }
          const restored = await reload();
          expect(restored.history).toEqual(baseline.history);
          await permissions.newButton.click();
          await expect(permissions.administrativeActInput).toHaveValue("");
          await expect(permissions.saveButton).toBeEnabled();
          await expect(permissions.deleteButton).toBeDisabled();
        }
      });
    }
  });
});
