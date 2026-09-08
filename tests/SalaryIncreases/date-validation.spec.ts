import { expect, test } from "../fixtures/auth.fixture";
import { SalaryIncreasesPage } from "../../pages/SalaryIncreases.page";

// spec: specs/salary-increases-plan.md
// seed: tests/SalaryIncreases/seed-test.spec.ts

test.describe("P0 - Initial state and calculation validation", () => {
  test("SI-005: Malformed date handling", async ({ page }) => {
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

    // 1. Start with a fresh authenticated context and keep one valid increase mode.
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
    for (const response of await Promise.all(startupPromises)) {
      expect(response.status(), response.url()).toBe(200);
      expect(await response.finished()).toBeNull();
    }
    await expect(salaryIncreasesPage.filterTab).toHaveAttribute("aria-selected", "true");
    await expect(salaryIncreasesPage.calculateButton).toBeEnabled();
    await salaryIncreasesPage.increaseValueInput.fill("100");
    await salaryIncreasesPage.percentageInput.fill("0");
    expect(calculations).toHaveLength(0);

    // 2. Enter the supplied extended-year date through the native input and inspect it before calculating.
    const date = "275760-09-09";
    await expect(salaryIncreasesPage.startDateInput).toHaveAttribute("type", "date");
    await salaryIncreasesPage.startDateInput.fill(date);
    await salaryIncreasesPage.startDateInput.press("Tab");
    await expect(salaryIncreasesPage.startDateInput).toHaveValue(date);
    await expect(salaryIncreasesPage.startDateInput).toHaveAttribute("aria-invalid", "false");
    await expect(salaryIncreasesPage.startDateInput.and(page.locator(":valid"))).toHaveCount(1);

    // 3. Submit the accepted value and compare the server rejection with the error dialog.
    const responsePromise = page.waitForResponse(response =>
      response.request().method() === "POST" && response.url().split("?")[0] === calculateUrl);
    await salaryIncreasesPage.calculateButton.click();
    const response = await responsePromise;
    expect(await response.finished()).toBeNull();
    expect(response.status()).toBe(400);
    expect(response.request().postDataJSON()).toEqual({
      tipoTercero: null, unidad: null, profesion: null, rango: null,
      fuerza: null, nivel: null, grado: null, nitInicial: null, nitFinal: null,
      salarioInicial: null, salarioFinal: null, porcentaje: 0, valor: 100,
      decreto: 0, fechaDesde: date, fechaIngresoDesde: null,
      aproximarCien: false, aumentoPorPuntos: false,
    });
    const error = await response.json();
    expect(error.code).toBe("BAD_REQUEST");
    expect(error.message).toBe("Text '275760-09-09' could not be parsed at index 0");
    await salaryIncreasesPage.expectApiErrorMessage(error.message);
    await salaryIncreasesPage.dialogButton("api-error", "confirm").click();
    await expect(salaryIncreasesPage.dialog("api-error")).toBeHidden();
    await salaryIncreasesPage.openIncreases();
    await expect(salaryIncreasesPage.visibleRows()).toHaveCount(0);
    await expect(salaryIncreasesPage.exportButton).toBeDisabled();
    await expect(salaryIncreasesPage.saveButton).toBeDisabled();
    expect(calculations).toHaveLength(1);
    expect(saves, "Malformed-date validation must never save salaries").toEqual([]);
  });
});
