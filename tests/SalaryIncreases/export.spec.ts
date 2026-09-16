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
  test("SI-025: Download format and all-page row mapping", async ({ page }, testInfo) => {
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
    test.skip(rows.length <= 25,
      "Shared QA requires more than 25 calculated employees to verify an all-page export");
    const normalize = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
    const byDocument = new Map(rows.map(row => [normalize(row.nNit), row]));
    expect(byDocument.size, "Calculation documents must uniquely identify employees").toBe(rows.length);
    expect([...byDocument.keys()]).not.toContain("");
    await expect(screen.increasesTab).toHaveAttribute("aria-selected", "true");
    await screen.expectPreviewSalaries(rows.slice(0, 25));
    await expect(screen.row(rows[25]!.kaNlTercero)).toBeHidden();

    // 2. Pre-arm the download, export, and save the actual workbook under the test output path.
    const downloadWait = page.waitForEvent("download");
    await screen.exportButton.click();
    const download = await downloadWait;
    expect(download.suggestedFilename()).toBe("w_aumento_sueldo.xls.xlsx");
    const outputPath = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(outputPath);
    expect(await download.failure()).toBeNull();
    const bytes = await readFile(outputPath);
    expect([...bytes.subarray(0, 4)], "XLSX ZIP signature").toEqual([0x50, 0x4b, 0x03, 0x04]);
    await testInfo.attach("salary-increases-export", {
      path: outputPath,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    // 3. Parse the workbook and compare every exported employee to the full calculation response.
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
    const exportedDocuments: string[] = [];
    for (let index = 2; index <= sheet.rowCount; index++) {
      const exported = sheet.getRow(index);
      const document = normalize(exported.getCell(2).value);
      exportedDocuments.push(document);
      const expected = byDocument.get(document);
      expect(expected, "Exported document " + document + " exists in the calculation").toBeDefined();
      for (let column = 1; column < headers.length; column++) {
        const key = headers[column]!;
        const actual = exported.getCell(column + 1);
        const label = "Document " + document + ", " + key;
        if (key === "ndSalarioMes" || key === "nuevoSalario") {
          expect(actual.value, label).toBe(expected![key]);
        } else if (key === "ddIngreso") {
          const displayDate = expected!.ddIngreso?.slice(0, 10).split("-").reverse().join("/") ?? "";
          expect(normalize(actual.text), label).toBe(displayDate);
        } else {
          expect(normalize(actual.text), label).toBe(normalize(expected![key]));
        }
      }
    }
    expect(new Set(exportedDocuments).size, "No duplicate exported documents").toBe(rows.length);
    expect(exportedDocuments.sort()).toEqual([...byDocument.keys()].sort());
    await screen.expectPreviewSalaries(rows.slice(0, 25));
    expect(calculations).toHaveLength(1);
    expect(saves, "Export must not persist salary changes").toEqual([]);
  });
});
