import { expect, test } from "../fixtures/auth.fixture";
import { SalaryIncreasesPage } from "../../pages/SalaryIncreases.page";

// spec: specs/salary-increases-plan.md
// seed: tests/SalaryIncreases/seed-test.spec.ts

type PreviewRow = {
  kaNlTercero: number;
  nNit: number;
  ndSalarioMes: number;
  nuevoSalario: number;
};

test.describe("P0 - Salary calculation and API-to-grid mapping", () => {
  test("SI-016: No eligible employees clears stale calculation", async ({ page }) => {
    test.setTimeout(60_000);
    const screen = new SalaryIncreasesPage(page);
    const calculateUrl = screen.apiBase + "w-aumento-sueldo/actions/calculate";
    let calculations = 0;
    const saves: string[] = [];
    const downloads: string[] = [];
    page.on("download", download => downloads.push(download.suggestedFilename()));
    page.on("request", request => {
      if (request.method() !== "POST") return;
      const url = request.url().split("?")[0];
      if (url === calculateUrl) calculations++;
      if (url === screen.apiBase + "w-aumento-sueldo/actions/grabar") saves.push(url);
    });

    // 1. Start fresh, obtain results and select an employee, then choose a valid nonmatching document range.
    const paths = [
      "w-aumento-sueldo/context",
      "w-aumento-sueldo/lookups/dw_drop_tipos_tercero",
      "w-aumento-sueldo/lookups/dw_drop_unidades_pago",
      "w-aumento-sueldo/lookups/dw_drop_profesiones",
      "w-empleados-p/lookups/dw_drop_cargos",
      "w-aumento-sueldo/lookups/dw-drop-secciones",
    ];
    const startup = paths.map(path => page.waitForResponse(response =>
      response.request().method() === "GET" && response.url().split("?")[0] === screen.apiBase + path));
    await screen.goto();
    const responses = await Promise.all(startup);
    for (const response of responses) {
      expect(response.status(), response.url()).toBe(200);
      expect(await response.finished()).toBeNull();
    }
    const context = await responses[0].json();
    const year = new URL(responses[0].url()).searchParams.get("year");
    expect(year).toMatch(/^\d{4}$/);
    test.skip(!(context.salarioMinimoActual > 0), "Shared QA has no minimum wage for the current context year");
    await screen.startDateInput.fill("11/09/" + year);
    await screen.increaseValueInput.fill("100");
    await screen.percentageInput.fill("0");
    const basePayload = {
      tipoTercero: null, unidad: null, profesion: null, rango: null, fuerza: null,
      nivel: null, grado: null, nitInicial: null, nitFinal: null,
      salarioInicial: null, salarioFinal: null, porcentaje: 0, valor: 100,
      decreto: 0, fechaDesde: year + "-09-11", fechaIngresoDesde: null,
      aproximarCien: false, aumentoPorPuntos: false,
    };
    const calculate = async (bounds: { nitInicial: number; nitFinal: number } | Record<string, never> = {}) => {
      const before = calculations;
      const pending = page.waitForResponse(response =>
        response.request().method() === "POST" && response.url().split("?")[0] === calculateUrl);
      await screen.calculateButton.click();
      const response = await pending;
      expect(await response.finished()).toBeNull();
      expect(response.status()).toBe(200);
      expect(response.request().postDataJSON()).toEqual({ ...basePayload, ...bounds });
      const body = await response.json();
      expect(body.context).toEqual(context);
      expect(Array.isArray(body.rows)).toBe(true);
      expect(calculations).toBe(before + 1);
      return body.rows as PreviewRow[];
    };
    const baseline = await calculate();
    test.skip(!baseline.length, "Shared QA requires a nonempty baseline to exercise stale preview removal");
    test.skip(baseline.some(row => Number(row.nNit) === 1),
      "The specified document range 1 through 1 must have no eligible employees in shared QA");
    await expect(screen.increasesTab).toHaveAttribute("aria-selected", "true");
    await screen.expectPreviewSalaries(baseline.slice(0, 25));
    const selected = baseline[0]!;
    await screen.rowCheckbox(selected.kaNlTercero).check();
    await expect(screen.rowCheckbox(selected.kaNlTercero)).toBeChecked();
    await expect(screen.exportButton).toBeEnabled();
    await expect(screen.saveButton).toBeEnabled();
    await screen.openFilters();
    await screen.documentStartInput.fill("1");
    await screen.documentEndInput.fill("1");
    await expect(screen.documentStartInput).toHaveValue("1");
    await expect(screen.documentEndInput).toHaveValue("1");
    expect(calculations).toBe(1);

    // 2. Calculate the empty combination, verify the dialog and selected tab, then dismiss the dialog.
    expect(await calculate({ nitInicial: 1, nitFinal: 1 })).toEqual([]);
    const dialog = screen.dialog("empty-results");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".swal2-html-container"))
      .toHaveText("No se encontraron empleados para el filtro actual");
    await expect(screen.increasesTab).toHaveAttribute("aria-selected", "true");
    await expect(screen.filterTab).toHaveAttribute("aria-selected", "false");
    await screen.dialogButton("empty-results", "confirm").click();
    await expect(dialog).toBeHidden();

    // 3. Inspect the increases grid and actions: remove old rows/selections and prevent empty-state export or save.
    await expect(screen.increasesTab).toHaveAttribute("aria-selected", "true");
    await expect(screen.table).toHaveCount(0);
    await expect(screen.visibleRows()).toHaveCount(0);
    await expect(page.getByTestId(/^aumento-sueldo-increases-row--/)).toHaveCount(0);
    await expect(screen.rowCheckbox(selected.kaNlTercero)).toHaveCount(0);
    for (const button of [screen.exportButton, screen.saveButton]) {
      await expect(button).toBeVisible();
      await expect(button).toBeDisabled();
      // Native click preserves the disabled guard; Playwright click would wait for enabled state.
      await button.evaluate(element => (element as HTMLButtonElement).click());
    }
    await screen.openFilters();
    await screen.openIncreases();
    await expect(screen.table).toHaveCount(0);
    await expect(screen.exportButton).toBeDisabled();
    await expect(screen.saveButton).toBeDisabled();
    expect(calculations).toBe(2);
    expect(downloads, "Empty preview must not download an export").toEqual([]);
    expect(saves, "Preview calculations must never persist salary changes").toEqual([]);
  });
});
