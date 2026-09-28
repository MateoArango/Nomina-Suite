import { expect, test } from "../fixtures/auth.fixture";
import { SalaryIncreasesPage } from "../../pages/SalaryIncreases.page";

// spec: specs/salary-increases-plan.md
// seed: tests/SalaryIncreases/seed-test.spec.ts

type CalculatedRow = {
  kaNlTercero: number;
  ndSalarioMes: number;
  nuevoSalario: number;
} & Record<string, unknown>;

test.describe("P1 - Exported table contract", () => {
  test("SI-028: Export disabled when search shows no records", async ({
    page,
  }) => {
    const screen = new SalaryIncreasesPage(page);
    const calculatePath =
      screen.apiBase + "w-aumento-sueldo/actions/calculate";
    const savePath = screen.apiBase + "w-aumento-sueldo/actions/grabar";
    const calculations: string[] = [];
    const saves: string[] = [];

    page.on("request", request => {
      if (request.method() !== "POST") return;
      const path = request.url().split("?")[0];
      if (path === calculatePath) calculations.push(request.url());
      if (path === savePath) saves.push(request.url());
    });

    // 1. Start fresh, settle startup traffic, and calculate a non-empty employee set.
    const startupPaths = [
      "w-aumento-sueldo/context",
      "w-aumento-sueldo/lookups/dw_drop_tipos_tercero",
      "w-aumento-sueldo/lookups/dw_drop_unidades_pago",
      "w-aumento-sueldo/lookups/dw_drop_profesiones",
      "w-empleados-p/lookups/dw_drop_cargos",
      "w-aumento-sueldo/lookups/dw-drop-secciones",
    ];
    const startupResponses = startupPaths.map(path =>
      page.waitForResponse(
        response =>
          response.request().method() === "GET" &&
          response.url().split("?")[0] === screen.apiBase + path,
      ),
    );

    await screen.goto();

    const responses = await Promise.all(startupResponses);
    for (const response of responses) {
      expect(response.status(), response.url()).toBe(200);
      expect(await response.finished(), response.url()).toBeNull();
    }

    const context = await responses[0]!.json();
    const year = new URL(responses[0]!.url()).searchParams.get("year");
    expect(year).toMatch(/^\d{4}$/);
    test.skip(
      !(context.salarioMinimoActual > 0),
      "Shared QA requires a context year with a configured positive minimum salary",
    );

    await screen.startDateInput.fill("28/09/" + year);
    await screen.increaseValueInput.fill("100");
    await screen.percentageInput.fill("0");

    const basePayload = {
      tipoTercero: null,
      unidad: null,
      profesion: null,
      rango: null,
      fuerza: null,
      nivel: null,
      grado: null,
      nitInicial: null,
      nitFinal: null,
      salarioInicial: null,
      salarioFinal: null,
      porcentaje: 0,
      valor: 100,
      decreto: 0,
      fechaDesde: year + "-09-28",
      fechaIngresoDesde: null,
      aproximarCien: false,
      aumentoPorPuntos: false,
    };
    const baselineResponsePromise = page.waitForResponse(
      response =>
        response.request().method() === "POST" &&
        response.url().split("?")[0] === calculatePath,
    );
    await screen.calculateButton.click();
    const baselineResponse = await baselineResponsePromise;
    expect(await baselineResponse.finished()).toBeNull();
    expect(baselineResponse.status()).toBe(200);
    expect(baselineResponse.request().postDataJSON()).toEqual(basePayload);

    const baselineBody = await baselineResponse.json();
    const rows: CalculatedRow[] = baselineBody.rows;
    expect(baselineBody.context).toEqual(context);
    expect(Array.isArray(rows)).toBe(true);
    test.skip(rows.length === 0, "Shared QA returned no calculated employees");
    expect(new Set(rows.map(row => row.kaNlTercero)).size).toBe(rows.length);
    await expect(screen.increasesTab).toHaveAttribute("aria-selected", "true");
    await screen.expectPreviewSalaries(rows.slice(0, 25));
    await expect(screen.exportButton).toBeEnabled();
    expect(calculations).toHaveLength(1);
    expect(saves).toEqual([]);

    // 2. Return to filters, enter the specified document bounds, and calculate again.
    await screen.openFilters();
    await screen.documentStartInput.fill("1231231231");
    await screen.documentEndInput.fill("12333333123123124");
    await expect(screen.documentStartInput).toHaveValue("1231231231");
    await expect(screen.documentEndInput).toHaveValue("12333333123123124");

    const filteredResponsePromise = page.waitForResponse(
      response =>
        response.request().method() === "POST" &&
        response.url().split("?")[0] === calculatePath,
    );
    await screen.calculateButton.click();
    const filteredResponse = await filteredResponsePromise;
    expect(await filteredResponse.finished()).toBeNull();
    expect(filteredResponse.status()).toBe(200);
    expect(filteredResponse.request().postDataJSON()).toEqual({
      ...basePayload,
      nitInicial: Number("1231231231"),
      nitFinal: Number("12333333123123124"),
    });

    const filteredBody = await filteredResponse.json();
    expect(filteredBody.context).toEqual(context);
    expect(filteredBody.rows).toEqual([]);

    const emptyDialog = screen.emptyResultsDialog;
    await expect(emptyDialog).toBeVisible();
    await expect(emptyDialog)
      .toContainText("No se encontraron empleados para el filtro actual");
    await screen.emptyResultsConfirmButton.click();
    await expect(emptyDialog).toBeHidden();

    // 3. Verify the empty increases grid cannot be exported or saved.
    await expect(screen.increasesTab).toHaveAttribute("aria-selected", "true");
    await expect(screen.visibleRows()).toHaveCount(0);
    await expect(screen.exportButton).toBeDisabled();
    await expect(screen.saveButton).toBeDisabled();
    expect(calculations).toHaveLength(2);
    expect(saves, "Filtering must not save salary changes").toEqual([]);
  });
});