import { expect, test } from "../fixtures/auth.fixture";
import type { Download, Request } from "@playwright/test";
import { Workbook } from "exceljs";
import { SalaryIncreasesPage } from "../../pages/SalaryIncreases.page";

// spec: specs/salary-increases-plan.md
// seed: tests/SalaryIncreases/seed-test.spec.ts

type Employee = { kaNlTercero: number; nNit: number };

test.describe("P1 - Exported table contract", () => {
  test("SI-027: Selection flags include selected and unselected rows", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const screen = new SalaryIncreasesPage(page);
    const calculatePath = screen.apiBase + "w-aumento-sueldo/actions/calculate";
    const moduleRequests: Request[] = [];
    page.on("request", request => {
      if (request.method() === "POST" && request.url().split("?")[0] === calculatePath) moduleRequests.push(request);
    });
    const startupPaths = [
      "w-aumento-sueldo/context",
      "w-aumento-sueldo/lookups/dw_drop_tipos_tercero",
      "w-aumento-sueldo/lookups/dw_drop_unidades_pago",
      "w-aumento-sueldo/lookups/dw_drop_profesiones",
      "w-empleados-p/lookups/dw_drop_cargos",
      "w-aumento-sueldo/lookups/dw-drop-secciones",
    ];
    const startup = startupPaths.map(path => page.waitForResponse(response =>
      response.request().method() === "GET" && response.url().split("?")[0] === screen.apiBase + path));
    await screen.goto();
    const startupResponses = await Promise.all(startup);
    for (const response of startupResponses) expect(response.status(), response.url()).toBe(200);
    const context = await startupResponses[0]!.json();
    const year = new URL(startupResponses[0]!.url()).searchParams.get("year")!;
    const date = `${year}-09-11`;
    const command = {
      tipoTercero: null, unidad: null, profesion: null, rango: null, fuerza: null,
      nivel: null, grado: null, nitInicial: null, nitFinal: null,
      salarioInicial: null, salarioFinal: null, porcentaje: 0, valor: 100,
      decreto: 0, fechaDesde: date, fechaIngresoDesde: null,
      aproximarCien: false, aumentoPorPuntos: false,
    };

    // 1. Start with a fresh authenticated browser context and calculate the runtime employee set.
    await screen.startDateInput.fill("11/09/" + year);
    await screen.increaseValueInput.fill("100");
    await screen.percentageInput.fill("0");
    const pendingCalculation = page.waitForResponse(response =>
      response.request().method() === "POST" && response.url().split("?")[0] === calculatePath);
    await screen.calculateButton.click();
    const calculation = await pendingCalculation;
    expect(calculation.status(), await calculation.text()).toBe(200);
    expect(calculation.request().postDataJSON()).toEqual(command);
    const body = await calculation.json() as { context: unknown; rows: Employee[] };
    expect(body.context).toEqual(context);
    expect(body.rows.length).toBeGreaterThan(25);
    expect(moduleRequests).toHaveLength(1);
    const rows = body.rows;
    const selectedIds = [rows[0]!.kaNlTercero, rows[25]!.kaNlTercero];
    const selectedDocuments = new Set(selectedIds.map(id => rows.find(row => row.kaNlTercero === id)!.nNit));
    const exportRows = async (label: string) => {
      const downloadPromise = page.waitForEvent("download");
      await screen.exportButton.click();
      const download: Download = await downloadPromise;
      const path = testInfo.outputPath(`${label}-${download.suggestedFilename()}`);
      await download.saveAs(path);
      const workbook = new Workbook();
      await workbook.xlsx.readFile(path);
      const worksheet = workbook.worksheets[0]!;
      const values = worksheet.getSheetValues().slice(2) as unknown[][];
      const byDocument = new Map<number, number>();
      for (const row of values) {
        const document = Number(row[2]);
        const flag = Number(row[1]);
        expect(Number.isFinite(document)).toBe(true);
        expect(flag === 0 || flag === 1).toBe(true);
        byDocument.set(document, flag);
      }
      expect(byDocument.size).toBe(rows.length);
      return byDocument;
    };

    // 2. Select a known subset across pages and export mixed selection, all selected, and all deselected states.
    await screen.pageSizeButton(25).click();
    await screen.rowCheckbox(selectedIds[0]!).check();
    await screen.nextPageButton.click();
    await screen.rowCheckbox(selectedIds[1]!).check();
    const mixed = await exportRows("mixed-selection");
    for (const row of rows) expect(mixed.get(row.nNit)).toBe(selectedDocuments.has(row.nNit) ? 1 : 0);

    await screen.selectAllButton.click();
    const allSelected = await exportRows("all-selected");
    for (const row of rows) expect(allSelected.get(row.nNit)).toBe(1);

    await screen.selectAllButton.click();
    const allDeselected = await exportRows("all-deselected");
    for (const row of rows) expect(allDeselected.get(row.nNit)).toBe(0);

    // 3. Match flags by employee identity so paging cannot associate a flag with another row.
    expect([...mixed.entries()].filter(([, flag]) => flag === 1).sort((a, b) => a[0] - b[0]))
      .toEqual([...selectedDocuments].map(document => [document, 1]).sort((a, b) => a[0] - b[0]));
    expect([...allSelected.values()].every(flag => flag === 1)).toBe(true);
    expect([...allDeselected.values()].every(flag => flag === 0)).toBe(true);
    expect(moduleRequests).toHaveLength(1);
  });
});
