import { readFile } from "node:fs/promises";
import { Workbook } from "exceljs";
import { expect, test } from "../fixtures/auth.fixture";
import { SalaryIncreasesPage } from "../../pages/SalaryIncreases.page";

// spec: specs/salary-increases-plan.md
// seed: tests/SalaryIncreases/seed-test.spec.ts

type CalculatedRow = {
  kaNlTercero: number;
  nNit: number;
  ddIngreso: string | null;
  ndSalarioMes: number;
  nuevoSalario: number;
} & Record<string, unknown>;

test.describe("P1 - Exported table contract", () => {
  test("SI-026: Export ignores page size", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const screen = new SalaryIncreasesPage(page);
    const calculatePath = screen.apiBase + "w-aumento-sueldo/actions/calculate";
    const saves: string[] = [];
    const calculations: string[] = [];
    page.on("request", request => {
      if (request.method() !== "POST") return;
      const path = request.url().split("?")[0];
      if (path === calculatePath) calculations.push(path);
      if (path === screen.apiBase + "w-aumento-sueldo/actions/grabar") saves.push(path);
    });

    // 1. Start with fresh authentication, settle startup, and calculate more than one page.
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
    test.skip(!(context.salarioMinimoActual > 0),
      "Shared QA requires a context year with a configured positive minimum salary");
    await screen.startDateInput.fill("16/09/" + year);
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
      decreto: 0, fechaDesde: year + "-09-16", fechaIngresoDesde: null,
      aproximarCien: false, aumentoPorPuntos: false,
    });
    const body = await response.json();
    expect(body.context).toEqual(context);
    expect(Array.isArray(body.rows)).toBe(true);
    const rows: CalculatedRow[] = body.rows;
    expect(saves).toEqual([]);
    test.skip(rows.length <= 100,
      "Shared QA requires more than 100 calculated employees to verify multi-page exports at every supported page size");
    const normalize = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
    const byDocument = new Map(rows.map(row => [normalize(row.nNit), row]));
    expect(byDocument.size, "Calculation documents must uniquely identify employees").toBe(rows.length);
    expect([...byDocument.keys()]).not.toContain("");
    await expect(screen.increasesTab).toHaveAttribute("aria-selected", "true");
    await screen.expectPreviewSalaries(rows.slice(0, 25));
    await expect(screen.row(rows[25]!.kaNlTercero)).toBeHidden();

    const moduleRequests: string[] = [];
    page.on("request", request => {
      if (request.url().startsWith(screen.apiBase + "w-aumento-sueldo/")) {
        moduleRequests.push(request.method() + " " + request.url());
      }
    });
    let baselineValues: unknown[][] | undefined;

    // 2. Export at page sizes 10, 25, 50 and 100 from a non-first page.
    for (const size of [10, 25, 50, 100] as const) {
      await screen.pageSizeButton(size).click();
      await screen.expectPreviewSalaries(rows.slice(0, size));
      await screen.nextPageButton.click();
      const visible = rows.slice(size, size * 2);
      await screen.expectPreviewSalaries(visible);
      await expect(screen.row(rows[0]!.kaNlTercero)).toBeHidden();
      const requestsBeforeExport = [...moduleRequests];
      const downloadWait = page.waitForEvent("download");
      await screen.exportButton.click();
      const download = await downloadWait;
      expect(download.suggestedFilename()).toBe("w_aumento_sueldo.xls.xlsx");
      const outputPath = testInfo.outputPath(String(size), download.suggestedFilename());
      await download.saveAs(outputPath);
      expect(await download.failure()).toBeNull();
      const bytes = await readFile(outputPath);
      expect([...bytes.subarray(0, 4)], "XLSX ZIP signature").toEqual([0x50, 0x4b, 0x03, 0x04]);
      await testInfo.attach("salary-increases-export-" + size, {
        path: outputPath,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      // Every file must contain the complete identity set and values, regardless of the visible page.
      const workbook = new Workbook();
      await workbook.xlsx.readFile(outputPath);
      expect(workbook.worksheets).toHaveLength(1);
      const sheet = workbook.worksheets[0]!;
      const headers = [
        "seleccion", "nNit", "scNombre", "scDetalleCargo", "ssSeccion",
        "scUnidadDePago", "sDescripcion", "tipoPension", "tipoCotizante",
        "ddIngreso", "ndSalarioMes", "nuevoSalario",
      ];
      expect(sheet.columnCount).toBe(headers.length);
      expect(headers.map((_, index) => sheet.getRow(1).getCell(index + 1).text)).toEqual(headers);
      expect(sheet.rowCount - 1, "All calculated rows, excluding the header").toBe(rows.length);
      const expectedRecords = rows.map(row => headers.slice(1).map(key => {
        if (key === "ndSalarioMes" || key === "nuevoSalario") return row[key];
        if (key === "ddIngreso") return row.ddIngreso?.slice(0, 10).split("-").reverse().join("/") ?? "";
        return normalize(row[key]);
      })).sort((left, right) => String(left[0]).localeCompare(String(right[0])));
      const exportedRecords = Array.from({ length: rows.length }, (_, index) =>
        headers.slice(1).map((key, column) => {
          const cell = sheet.getRow(index + 2).getCell(column + 2);
          return key === "ndSalarioMes" || key === "nuevoSalario" ? cell.value : normalize(cell.text);
        })).sort((left, right) => String(left[0]).localeCompare(String(right[0])));
      expect(exportedRecords, "Every exported identity and value matches the full calculation").toEqual(expectedRecords);
      const values = Array.from({ length: sheet.rowCount }, (_, index) =>
        headers.map((_, column) => sheet.getRow(index + 1).getCell(column + 1).value));
      if (baselineValues) expect(values, "Workbook values must be independent of page size").toEqual(baselineValues);
      else baselineValues = values;
      await screen.expectPreviewSalaries(visible);
      expect(moduleRequests, "Client-side export must call no salary-module endpoint").toEqual(requestsBeforeExport);
      await screen.previousPageButton.click();
      await screen.expectPreviewSalaries(rows.slice(0, size));
    }
    expect(moduleRequests, "Paging and export must remain client-side").toEqual([]);
    expect(calculations).toHaveLength(1);
    expect(saves, "Export must not persist salary changes").toEqual([]);
  });
});

