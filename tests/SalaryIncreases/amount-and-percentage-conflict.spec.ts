import { expect, test } from "../fixtures/auth.fixture";
import { SalaryIncreasesPage } from "../../pages/SalaryIncreases.page";

// spec: specs/salary-increases-plan.md
// seed: tests/SalaryIncreases/seed-test.spec.ts

test.describe("P0 - Initial state and calculation validation", () => {
  test("SI-003: Amount and percentage conflict", async ({ page }) => {
    const salaryIncreasesPage = new SalaryIncreasesPage(page);
    const calculateUrl = salaryIncreasesPage.apiBase + "w-aumento-sueldo/actions/calculate";
    const calculations: string[] = [];
    const saves: string[] = [];
    page.on("request", request => {
      if (request.method() !== "POST") return;
      const url = request.url().split("?")[0];
      if (url === calculateUrl) calculations.push(url);
      if (url === salaryIncreasesPage.apiBase + "w-aumento-sueldo/actions/grabar") saves.push(url);
    });

    // 1. Start with a fresh authenticated context and use a context-supported increase date.
    const startupPaths = [
      "w-aumento-sueldo/context",
      "w-aumento-sueldo/lookups/dw_drop_tipos_tercero",
      "w-aumento-sueldo/lookups/dw_drop_unidades_pago",
      "w-aumento-sueldo/lookups/dw_drop_profesiones",
      "w-empleados-p/lookups/dw_drop_cargos",
      "w-aumento-sueldo/lookups/dw-drop-secciones",
    ];
    const startupPromises = startupPaths.map(path => page.waitForResponse(response =>
      response.request().method() === "GET" && response.url().split("?")[0] === salaryIncreasesPage.apiBase + path));
    await salaryIncreasesPage.goto();
    const startupResponses = await Promise.all(startupPromises);
    for (const response of startupResponses) {
      expect(response.status(), response.url()).toBe(200);
      expect(await response.finished()).toBeNull();
    }
    const year = new URL(startupResponses[0].url()).searchParams.get("year");
    expect(year).toMatch(/^\d{4}$/);
    const context = await startupResponses[0].json();
    const date = year + "-01-01";
    await expect(salaryIncreasesPage.filterTab).toHaveAttribute("aria-selected", "true");
    await expect(salaryIncreasesPage.calculateButton).toBeEnabled();
    expect(calculations).toHaveLength(0);

    // 2. Enter a positive amount and positive percentage; submit Calculate.
    await salaryIncreasesPage.startDateInput.fill(date);
    await salaryIncreasesPage.increaseValueInput.fill("100");
    await salaryIncreasesPage.percentageInput.fill("5");
    const invalidPromise = page.waitForResponse(response =>
      response.request().method() === "POST" && response.url().split("?")[0] === calculateUrl);
    await salaryIncreasesPage.calculateButton.click();
    const invalidResponse = await invalidPromise;
    expect(await invalidResponse.finished()).toBeNull();
    expect(invalidResponse.status()).toBe(400);
    const invalidPayload = invalidResponse.request().postDataJSON();
    expect(invalidPayload).toMatchObject({ valor: 100, porcentaje: 5, fechaDesde: date });
    const error = await invalidResponse.json();
    expect(error.code).toBe("BAD_REQUEST");
    expect(error.message).toBe("No puede registrar valor a incrementar y porcentaje a incrementar al mismo tiempo");
    await salaryIncreasesPage.expectApiErrorMessage(error.message);
    expect(calculations).toHaveLength(1);
    await expect(salaryIncreasesPage.visibleRows()).toHaveCount(0);

    // 3. Dismiss the error, set amount to zero, and calculate again.
    await salaryIncreasesPage.dialogButton("api-error", "confirm").click();
    await expect(salaryIncreasesPage.dialog("api-error")).toBeHidden();
    await salaryIncreasesPage.increaseValueInput.fill("0");
    await expect(salaryIncreasesPage.percentageInput).toHaveValue("5");
    const validPromise = page.waitForResponse(response =>
      response.request().method() === "POST" && response.url().split("?")[0] === calculateUrl);
    await salaryIncreasesPage.calculateButton.click();
    const validResponse = await validPromise;
    expect(await validResponse.finished()).toBeNull();
    expect(validResponse.status()).toBe(200);
    expect(validResponse.request().postDataJSON()).toEqual({ ...invalidPayload, valor: 0 });
    const body = await validResponse.json();
    expect(body.context).toEqual(context);
    expect(Array.isArray(body.rows)).toBe(true);
    expect(body.rows.length, "The live dataset must contain matching employees").toBeGreaterThan(0);
    await expect(salaryIncreasesPage.dialog("api-error")).toBeHidden();
    await expect(salaryIncreasesPage.increasesTab).toHaveAttribute("aria-selected", "true");
    await expect(salaryIncreasesPage.table).toBeVisible();
    await expect(salaryIncreasesPage.visibleRows()).toHaveCount(Math.min(25, body.rows.length));
    for (const row of body.rows.slice(0, 25)) {
      await expect(salaryIncreasesPage.row(row.kaNlTercero)).toBeVisible();
    }
    await expect(salaryIncreasesPage.exportButton).toBeEnabled();
    expect(calculations).toHaveLength(2);
    expect(saves, "Conflict validation and recovery must never save salaries").toEqual([]);
  });
});
