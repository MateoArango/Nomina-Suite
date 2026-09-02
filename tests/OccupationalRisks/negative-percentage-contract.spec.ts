// spec: specs/riesgos-profesionales-plan.md
// seed: tests/riesgosProfesionales/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { RiesgosProfesionalesPage } from "../../pages/RiesgosProfesionales.page";

type RiskRecord = {
  kaNlClase: number;
  scCodigo: string;
  ssClase: string;
  ndPorcentaje: number;
};

const rowsUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/rows";
const saveUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/actions/grabar";
const deleteUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/actions/borrar";
//"RP-012 is pending the product owner's decision on whether negative percentages are valid.
//"RP-012 is pending the product owner's decision on whether negative percentages are valid.
test.describe("Validation and backend error contracts", () => {
  test("RP-012: Negative percentage captures observed behavior as a product contract decision", async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);

    testInfo.annotations.push({
      type: "business-rule-gap",
      description:
        "The application currently accepts a negative risk percentage; this is observed behavior, not the desired rule.",
    });
    /*     test.skip(
      true,
      "RP-012 is pending the product owner's decision on whether negative percentages are valid.",
    ); */

    const risksPage = new RiesgosProfesionalesPage(page);
    const createdIds = new Set<number>();
    let disposableCode: string | undefined;
    let authorization: string | undefined;

    const readRows = async (): Promise<RiskRecord[]> => {
      if (!authorization) {
        throw new Error(
          "The authenticated browser request did not provide an authorization header.",
        );
      }

      const response = await page.request.get(rowsUrl, {
        headers: { authorization },
      });
      expect(response.ok()).toBe(true);
      return (await response.json()) as RiskRecord[];
    };

    const locateAndSelectCreatedRows = async (): Promise<void> => {
      const pendingIds = new Set(createdIds);
      await risksPage.pageSizeButton(100).click();

      while (pendingIds.size > 0) {
        for (const id of [...pendingIds]) {
          const checkbox = risksPage.riskCheckbox(id);

          if ((await checkbox.count()) === 1 && (await checkbox.isVisible())) {
            await checkbox.check();
            pendingIds.delete(id);
          }
        }

        if (pendingIds.size === 0) {
          break;
        }

        if (await risksPage.nextPageButton.isDisabled()) {
          throw new Error(
            `Unable to find test-owned occupational-risk IDs: ${[
              ...pendingIds,
            ].join(", ")}`,
          );
        }

        await risksPage.nextPageButton.click();
      }
    };

    try {
      // 1. Create a disposable record with percentage -10 using an unused three-character code and capture the save response.
      const initialRowsResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === rowsUrl && response.request().method() === "GET",
      );
      await page.goto("https://nomina-qa.adacsc.co/riesgos-profesionales");

      const initialRowsResponse = await initialRowsResponsePromise;
      expect(initialRowsResponse.ok()).toBe(true);
      authorization = (await initialRowsResponse.request().allHeaders())
        .authorization;
      expect(
        authorization,
        "The initial browser /rows request must be authenticated.",
      ).toBeTruthy();
      const initialRows = (await initialRowsResponse.json()) as RiskRecord[];
      const usedCodes = new Set(
        initialRows.map((risk) => String(risk.scCodigo).toUpperCase()),
      );
      const candidateOffset = (Date.now() + testInfo.workerIndex) % (36 * 36);

      for (let attempt = 0; attempt < 36 * 36; attempt += 1) {
        const candidate = `N${((candidateOffset + attempt) % (36 * 36))
          .toString(36)
          .toUpperCase()
          .padStart(2, "0")}`;

        if (!usedCodes.has(candidate)) {
          disposableCode = candidate;
          break;
        }
      }

      test.skip(
        !disposableCode,
        "RP-012 requires an unused code in the N00-NZZ range.",
      );

      await risksPage.createButton.click();
      await risksPage.codeInput.fill(disposableCode!);
      await risksPage.classInput.fill("RP-012 NEGATIVE");
      await risksPage.percentageInput.fill("-10");

      const saveResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === saveUrl && response.request().method() === "POST",
      );
      await risksPage.saveButton.click();

      const saveResponse = await saveResponsePromise;
      expect(saveResponse.ok()).toBe(true);
      expect(saveResponse.request().postDataJSON()).toMatchObject({
        kaNlClase: null,
        scCodigo: disposableCode,
        ssClase: "RP-012 NEGATIVE",
        ndPorcentaje: -10,
      });

      const rowsAfterSave = await readRows();
      const createdMatches = rowsAfterSave.filter(
        (risk) => risk.scCodigo === disposableCode,
      );
      expect(createdMatches).toHaveLength(1);
      expect(createdMatches[0].ndPorcentaje).toBe(-10);
      createdIds.add(createdMatches[0].kaNlClase);

      // 2. If accepted, reload and verify through a fresh /rows response that -10 persisted for the returned ID.
      const reloadedRowsResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === rowsUrl && response.request().method() === "GET",
      );
      await page.reload();

      const reloadedRowsResponse = await reloadedRowsResponsePromise;
      expect(reloadedRowsResponse.ok()).toBe(true);
      const reloadedRows = (await reloadedRowsResponse.json()) as RiskRecord[];
      expect(
        reloadedRows.filter(
          (risk) =>
            createdIds.has(risk.kaNlClase) &&
            risk.scCodigo === disposableCode &&
            risk.ndPorcentaje === -10,
        ),
      ).toHaveLength(1);
    } finally {
      // 3. If the record was created, delete it by its returned/runtime ID and verify absence in a fresh /rows response.
      if (authorization && disposableCode) {
        const currentRows = await readRows();
        for (const risk of currentRows) {
          if (risk.scCodigo === disposableCode) {
            createdIds.add(risk.kaNlClase);
          }
        }
      }

      if (createdIds.size > 0) {
        const cleanupRowsResponsePromise = page.waitForResponse(
          (response) =>
            response.url() === rowsUrl && response.request().method() === "GET",
        );
        await page.reload();
        await cleanupRowsResponsePromise;
        await locateAndSelectCreatedRows();

        const deleteResponsePromise = page.waitForResponse(
          (response) =>
            response.url() === deleteUrl &&
            response.request().method() === "POST",
        );
        await risksPage.deleteButton.click();
        await expect(risksPage.deleteConfirmButton).toBeVisible();
        await risksPage.deleteConfirmButton.click();

        const deleteResponse = await deleteResponsePromise;
        expect(deleteResponse.ok()).toBe(true);
        const deletedIds = (
          deleteResponse.request().postDataJSON() as { ids?: number[] }
        ).ids;
        expect(new Set(deletedIds)).toEqual(createdIds);

        const remainingRows = await readRows();
        expect(
          remainingRows.filter((risk) => createdIds.has(risk.kaNlClase)),
        ).toHaveLength(0);
        expect(
          remainingRows.filter((risk) => risk.scCodigo === disposableCode),
        ).toHaveLength(0);
      }
    }
  });
});
