import { expect, test } from "../fixtures/auth.fixture";
import { SalaryIncreasesPage } from "../../pages/SalaryIncreases.page";

// spec: specs/salary-increases-plan.md
// seed: tests/SalaryIncreases/seed-test.spec.ts

test.describe("P0 - Initial state and calculation validation", () => {
  test("SI-004: Amount and percentage boundaries", async ({ page }) => {
    test.setTimeout(180_000);
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
    const missingIncrease = "Se debe registrar valor a incrementar o porcentaje a incrementar ";
    // These assertions characterize observed behavior, including silent normalization.
    // They do not establish approved limits or decimal/negative-value business rules.
    const cases: Array<{
      field: "amount" | "percentage"; input: string; displayed: string;
      numeric: number; mode: "type" | "paste"; error?: boolean;
    }> = [
      { field: "amount", input: "", displayed: "", numeric: 0, mode: "type", error: true },
      { field: "amount", input: "0", displayed: "$0", numeric: 0, mode: "type", error: true },
      { field: "amount", input: "-1", displayed: "$1", numeric: 1, mode: "type" },
      { field: "amount", input: "1", displayed: "$1", numeric: 1, mode: "type" },
      { field: "amount", input: "1.25", displayed: "$125", numeric: 125, mode: "type" },
      { field: "amount", input: "1.25", displayed: "$1", numeric: 1, mode: "paste" },
      { field: "amount", input: "$1,234.56", displayed: "$1,234", numeric: 1234, mode: "paste" },
      { field: "amount", input: "22222222222222", displayed: "$22,222,222,222,222", numeric: 22222222222222, mode: "type" },
      { field: "amount", input: "222222222222222", displayed: "$222,222,222,222,222", numeric: 222222222222222, mode: "type" },
      { field: "amount", input: "2222222222222222", displayed: "$222,222,222,222,222", numeric: 222222222222222, mode: "type" },
      ...[
        { input: "", numeric: 0, error: true },
        { input: "0", numeric: 0, error: true },
        { input: "-1", numeric: -1, error: true },
        { input: "1", numeric: 1 },
        { input: "1.25", numeric: 1.25 },
        { input: "111111111111", numeric: 111111111111 },
        { input: "1111111111111", numeric: 1111111111111 },
        { input: "1.1111111111111112e+211", numeric: 1.1111111111111112e+211 },
      ].map(value => ({ ...value, field: "percentage" as const, displayed: value.input,
        mode: value.input.includes("e+") ? "paste" as const : "type" as const })),
    ];
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: "https://nomina-qa.adacsc.co",
    });
    for (const scenario of cases) {
      await test.step(`${scenario.field}: ${scenario.mode} "${scenario.input}"`, async () => {
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
        const date = year + "-01-01";
        await expect(salaryIncreasesPage.filterTab).toHaveAttribute("aria-selected", "true");
        await expect(salaryIncreasesPage.startDateInput).toHaveValue("");
        await expect(salaryIncreasesPage.calculateButton).toBeEnabled();
        const countBefore = calculations.length;

        // 2. Enter each boundary independently, with the other mode zero; verify normalization before and after blur.
        await salaryIncreasesPage.percentageInput.fill("0");
        await salaryIncreasesPage.increaseValueInput.fill("0");
        await salaryIncreasesPage.startDateInput.fill(date);
        const input = scenario.field === "amount"
          ? salaryIncreasesPage.increaseValueInput : salaryIncreasesPage.percentageInput;
        await input.fill("");
        if (scenario.mode === "paste") {
          await page.evaluate(value => navigator.clipboard.writeText(value), scenario.input);
          await input.press("ControlOrMeta+V");
        } else if (scenario.input) {
          await input.pressSequentially(scenario.input);
        }
        await expect(input).toHaveValue(scenario.displayed);
        await input.press("Tab");
        await expect(input).toHaveValue(scenario.displayed);
        const otherInput = scenario.field === "amount"
          ? salaryIncreasesPage.percentageInput : salaryIncreasesPage.increaseValueInput;
        await expect(otherInput).toHaveValue(scenario.field === "amount" ? "0" : "$0");
        const percentage = scenario.field === "percentage" ? scenario.numeric : 0;
        const amount = scenario.field === "amount" ? scenario.numeric : 0;

        // 3. Submit Calculate and verify its payload, response and fresh preview or validation.
        const responsePromise = page.waitForResponse(response =>
          response.request().method() === "POST" && response.url().split("?")[0] === calculateUrl);
        await salaryIncreasesPage.calculateButton.click();
        const response = await responsePromise;
        expect(await response.finished()).toBeNull();
        expect(response.request().postDataJSON()).toEqual({
          tipoTercero: null, unidad: null, profesion: null, rango: null, fuerza: null,
          nivel: null, grado: null, nitInicial: null, nitFinal: null,
          salarioInicial: null, salarioFinal: null, porcentaje: percentage,
          valor: amount, decreto: 0, fechaDesde: date, fechaIngresoDesde: null,
          aproximarCien: false, aumentoPorPuntos: false,
        });
        expect(response.status()).toBe(scenario.error ? 400 : 200);
        const body = await response.json();

        if (scenario.error) {
          expect(body).toMatchObject({ code: "BAD_REQUEST", message: missingIncrease });
          await salaryIncreasesPage.expectApiErrorMessage(missingIncrease);
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
            expect(Number.isFinite(row.nuevoSalario), "Preview salary must be finite").toBe(true);
          }
          await salaryIncreasesPage.expectPreviewSalaries(body.rows.slice(0, 25));
          await expect(salaryIncreasesPage.exportButton).toBeEnabled();
        }
        expect(calculations).toHaveLength(countBefore + 1);
        expect(saves, "Numeric boundary calculations must never save salaries").toEqual([]);
      });
    }
  });
});
