import { expect, test } from "../fixtures/auth.fixture";
import { SalaryIncreasesPage } from "../../pages/SalaryIncreases.page";

// spec: specs/salary-increases-plan.md
// seed: tests/SalaryIncreases/seed-test.spec.ts

test.describe("P0 - Initial state and calculation validation", () => {
  test("SI-002: Required input matrix uses server validation", async ({ page }) => {
    test.setTimeout(90_000);
    const salaryIncreasesPage = new SalaryIncreasesPage(page);
    const calculateUrl = salaryIncreasesPage.apiBase + "w-aumento-sueldo/actions/calculate";
    const saveUrl = salaryIncreasesPage.apiBase + "w-aumento-sueldo/actions/grabar";
    const calculations: string[] = [];
    const saves: string[] = [];
    page.on("request", request => {
      if (request.method() !== "POST") return;
      const url = request.url().split("?")[0];
      if (url === calculateUrl) calculations.push(url);
      if (url === saveUrl) saves.push(url);
    });
    const missingDate = "Debe ingresar la fecha desde la cual aplica el incremento";
    // The API and dialog textContent retain this trailing space.
    const missingIncrease = "Se debe registrar valor a incrementar o porcentaje a incrementar ";
    const cases = [
      { name: "All defaults", dated: false, value: 0, percentage: 0, error: missingDate },
      { name: "Date only", dated: true, value: 0, percentage: 0, error: missingIncrease },
      { name: "Positive amount without date", dated: false, value: 100, percentage: 0, error: missingDate },
      { name: "Positive percentage without date", dated: false, value: 0, percentage: 5, error: missingDate },
      { name: "Date plus positive amount", dated: true, value: 100, percentage: 0, error: null },
      { name: "Date plus positive percentage", dated: true, value: 0, percentage: 5, error: null },
    ];
    for (const scenario of cases) {
      await test.step(scenario.name, async () => {
        // 1. Start with fresh authenticated page state and settle startup traffic for each matrix row.
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
        const date = scenario.dated ? year + "-01-01" : null;
        await expect(salaryIncreasesPage.filterTab).toHaveAttribute("aria-selected", "true");
        await expect(salaryIncreasesPage.startDateInput).toHaveValue("");
        await expect(salaryIncreasesPage.calculateButton).toBeEnabled();
        const countBefore = calculations.length;

        // 2. Submit the matrix row, explicitly setting the unused increase mode to zero.
        await salaryIncreasesPage.percentageInput.fill(String(scenario.percentage));
        await salaryIncreasesPage.increaseValueInput.fill(String(scenario.value));
        if (date) await salaryIncreasesPage.startDateInput.fill(date);
        const responsePromise = page.waitForResponse(response =>
          response.request().method() === "POST" && response.url().split("?")[0] === calculateUrl);
        await salaryIncreasesPage.calculateButton.click();
        const response = await responsePromise;
        expect(await response.finished()).toBeNull();
        expect(response.request().postDataJSON()).toEqual({
          tipoTercero: null, unidad: null, profesion: null, rango: null, fuerza: null,
          nivel: null, grado: null, nitInicial: null, nitFinal: null,
          salarioInicial: null, salarioFinal: null, porcentaje: scenario.percentage,
          valor: scenario.value, decreto: 0, fechaDesde: date, fechaIngresoDesde: null,
          aproximarCien: false, aumentoPorPuntos: false,
        });
        expect(response.status()).toBe(scenario.error ? 400 : 200);
        const body = await response.json();

        // 3. Inspect and dismiss each invalid dialog; valid modes must show a fresh calculation.
        if (scenario.error) {
          expect(body).toMatchObject({ code: "BAD_REQUEST", message: scenario.error });
          await salaryIncreasesPage.expectApiErrorMessage(body.message);
          await salaryIncreasesPage.dialogButton("api-error", "confirm").click();
          await expect(salaryIncreasesPage.dialog("api-error")).toBeHidden();
          await salaryIncreasesPage.openIncreases();
          await expect(salaryIncreasesPage.table).toHaveCount(0);
          await expect(salaryIncreasesPage.visibleRows()).toHaveCount(0);
          await expect(salaryIncreasesPage.exportButton).toBeDisabled();
          await expect(salaryIncreasesPage.saveButton).toBeDisabled();
        } else {
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
        }
        expect(calculations).toHaveLength(countBefore + 1);
        expect(saves, "Required-input validation must never save salaries").toEqual([]);
      });
    }
  });
});
