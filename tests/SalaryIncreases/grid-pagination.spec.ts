import { expect, test } from "../fixtures/auth.fixture";
import { SalaryIncreasesPage } from "../../pages/SalaryIncreases.page";

// spec: specs/salary-increases-plan.md
// seed: tests/SalaryIncreases/seed-test.spec.ts

test.describe("P1 - Grid, search, selection and undo", () => {
  test("SI-017: All page sizes and navigation", async ({ page }) => {
    test.setTimeout(240_000);
    const screen = new SalaryIncreasesPage(page);
    const calculatePath = screen.apiBase + "w-aumento-sueldo/actions/calculate";
    const savePath = screen.apiBase + "w-aumento-sueldo/actions/grabar";
    const calculations: string[] = [];
    const saves: string[] = [];
    page.on("request", request => {
      if (request.method() !== "POST") return;
      const path = request.url().split("?")[0];
      if (path === calculatePath) calculations.push(request.url());
      if (path === savePath) saves.push(request.url());
    });

    // 1. Start with a fresh authenticated context, settle startup, and calculate more than 100 runtime rows.
    const paths = [
      "w-aumento-sueldo/context",
      "w-aumento-sueldo/lookups/dw_drop_tipos_tercero",
      "w-aumento-sueldo/lookups/dw_drop_unidades_pago",
      "w-aumento-sueldo/lookups/dw_drop_profesiones",
      "w-empleados-p/lookups/dw_drop_cargos",
      "w-aumento-sueldo/lookups/dw-drop-secciones",
    ];
    const startup = paths.map(path => page.waitForResponse(response =>
      response.request().method() === "GET" &&
      response.url().split("?")[0] === screen.apiBase + path));
    await screen.goto();
    const responses = await Promise.all(startup);
    for (const response of responses) {
      expect(response.status(), response.url()).toBe(200);
      expect(await response.finished()).toBeNull();
    }
    const context = await responses[0]!.json();
    const year = new URL(responses[0]!.url()).searchParams.get("year");
    expect(year).toMatch(/^\d{4}$/);
    await screen.startDateInput.fill("11/09/" + year);
    await screen.increaseValueInput.fill("100");
    await screen.percentageInput.fill("0");
    const pending = page.waitForResponse(response =>
      response.request().method() === "POST" && response.url().split("?")[0] === calculatePath);
    await screen.calculateButton.click();
    const response = await pending;
    expect(await response.finished()).toBeNull();
    expect(response.status()).toBe(200);
    expect(response.request().postDataJSON()).toEqual({
      tipoTercero: null, unidad: null, profesion: null, rango: null, fuerza: null,
      nivel: null, grado: null, nitInicial: null, nitFinal: null,
      salarioInicial: null, salarioFinal: null, porcentaje: 0, valor: 100,
      decreto: 0, fechaDesde: year + "-09-11", fechaIngresoDesde: null,
      aproximarCien: false, aumentoPorPuntos: false,
    });
    const body = await response.json();
    expect(body.context).toEqual(context);
    expect(Array.isArray(body.rows)).toBe(true);
    const rows: Array<{ kaNlTercero: number; ndSalarioMes: number; nuevoSalario: number }> = body.rows;
    expect(calculations).toHaveLength(1);
    expect(saves).toEqual([]);
    test.skip(rows.length <= 100,
      "Shared QA requires more than 100 calculated employees to exercise every page size across pages");
    expect(new Set(rows.map(row => row.kaNlTercero)).size).toBe(rows.length);
    await expect(screen.increasesTab).toHaveAttribute("aria-selected", "true");

    // 2. Exercise sizes 10, 25, 50 and 100, navigating every page to the last and back to the first.
    for (const size of [10, 25, 50, 100] as const) {
      await test.step("Page size " + size, async () => {
        await screen.pageSizeButton(size).click();
        const lastPage = Math.ceil(rows.length / size) - 1;
        const verifyPage = async (index: number) => {
          const start = index * size;
          const end = Math.min(start + size, rows.length);
          await expect.poll(() => screen.visibleRows().evaluateAll(elements =>
            elements.map(element => element.getAttribute("data-testid")))).toEqual(
            rows.slice(start, end).map(row => "aumento-sueldo-increases-row--" + row.kaNlTercero));
          await expect(page.getByText(
            (start + 1) + "-" + end + " de " + rows.length, { exact: true },
          )).toBeVisible();
          await expect(screen.table.locator('tr[data-testid^="aumento-sueldo-increases-row--"]'))
            .toHaveCount(rows.length);
          await expect(screen.row(rows[index === 0 ? end : 0]!.kaNlTercero)).toBeHidden();

          // 3. Verify Previous/Next boundary states and no recalculation or salary persistence.
          await expect(screen.previousPageButton).toBeEnabled({ enabled: index !== 0 });
          await expect(screen.nextPageButton).toBeEnabled({ enabled: index !== lastPage });
          expect(calculations).toHaveLength(1);
          expect(saves).toEqual([]);
        };
        await verifyPage(0);
        for (let index = 1; index <= lastPage; index++) {
          await screen.nextPageButton.click();
          await verifyPage(index);
        }
        for (let index = lastPage - 1; index >= 0; index--) {
          await screen.previousPageButton.click();
          await verifyPage(index);
        }
      });
    }
    expect(calculations).toHaveLength(1);
    expect(saves).toEqual([]);
  });
});
