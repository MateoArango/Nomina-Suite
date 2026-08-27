// spec: specs/riesgos-profesionales-plan.md
// seed: tests/riesgosProfesionales/seed-test.spec.ts

import type { Request } from "@playwright/test";
import { expect, test } from "../fixtures/auth.fixture";
import { RiesgosProfesionalesPage } from "../../pages/RiesgosProfesionales.page";

type RiskRow = {
  kaNlClase: number;
  scCodigo: string;
  ssClase: string;
  ndPorcentaje: number;
};

type RiskDetail = RiskRow & {
  kaNlActividad: number;
  scCodActividad: number;
  ssActividad: string;
};

type Activity = {
  kaNlActividad: number;
  scCodActividad: number;
  ssActividad: string;
};

const pageUrl = "https://nomina-qa.adacsc.co/riesgos-profesionales";
const rowsUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/rows";
const activitiesUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/lookups/dddw-actividad-riesgo";
const saveUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/actions/grabar";
const deleteUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/actions/borrar";

test.describe("CRUD persistence and safe deletion", () => {
  test("RP-018: Create a complete record, verify persistence, and clean up", async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);

    const risksPage = new RiesgosProfesionalesPage(page);
    const className = "RP-018 COMPLETE";
    const percentage = 12.345;
    const baselineIds = new Set<number>();
    const createdIds = new Set<number>();
    let disposableCode: string | undefined;
    let saveSucceeded = false;
    let authorization: string | undefined;

    const readRows = async (): Promise<RiskRow[]> => {
      if (!authorization) {
        throw new Error(
          "The authenticated browser request did not provide an authorization header.",
        );
      }

      const response = await page.request.get(rowsUrl, {
        headers: { authorization },
      });
      expect(response.ok()).toBe(true);
      return (await response.json()) as RiskRow[];
    };

    const locateAndSelectCreatedId = async (id: number): Promise<void> => {
      await risksPage.pageSizeButton(100).click();

      while (true) {
        const checkbox = risksPage.riskCheckbox(id);

        if ((await checkbox.count()) === 1 && (await checkbox.isVisible())) {
          await checkbox.check();
          return;
        }

        if (await risksPage.nextPageButton.isDisabled()) {
          throw new Error(
            `Unable to find test-owned occupational-risk ID ${id} for cleanup.`,
          );
        }

        await risksPage.nextPageButton.click();
      }
    };

    const saveRequests: Request[] = [];
    const recordSaveRequest = (request: Request): void => {
      if (request.method() === "POST" && request.url() === saveUrl) {
        saveRequests.push(request);
      }
    };

    try {
      // 1. Read /rows and choose a distinct unused three-character code for this test/worker; select one activity by runtime kaNlActividad; retain the baseline ID set only as a safety boundary.
      const initialRowsResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === rowsUrl && response.request().method() === "GET",
      );
      const activitiesResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === activitiesUrl &&
          response.request().method() === "GET",
      );
      await page.goto(pageUrl);

      const [initialRowsResponse, activitiesResponse] = await Promise.all([
        initialRowsResponsePromise,
        activitiesResponsePromise,
      ]);
      expect(initialRowsResponse.ok()).toBe(true);
      expect(activitiesResponse.ok()).toBe(true);
      authorization = (await initialRowsResponse.request().allHeaders())
        .authorization;
      expect(
        authorization,
        "The initial browser /rows request must be authenticated.",
      ).toBeTruthy();

      const initialRows = (await initialRowsResponse.json()) as RiskRow[];
      const activities = (await activitiesResponse.json()) as Activity[];
      initialRows.forEach((risk) => baselineIds.add(risk.kaNlClase));

      const usedCodes = new Set(
        initialRows.map((risk) => String(risk.scCodigo).toUpperCase()),
      );
      const candidateOffset = (Date.now() + testInfo.workerIndex) % (36 * 36);

      for (let attempt = 0; attempt < 36 * 36; attempt += 1) {
        const candidate = `C${((candidateOffset + attempt) % (36 * 36))
          .toString(36)
          .toUpperCase()
          .padStart(2, "0")}`;

        if (!usedCodes.has(candidate)) {
          disposableCode = candidate;
          break;
        }
      }

      test.skip(
        disposableCode === undefined || activities.length === 0,
        "RP-018 requires one unused C00-CZZ code and one runtime activity.",
      );

      // 2. Click New, fill valid code, class, and percentage, apply the selected activity, start waiting for POST /actions/grabar, and click Save once.
      await risksPage.createButton.click();
      await risksPage.codeInput.fill(disposableCode!);
      await risksPage.classInput.fill(className);
      await risksPage.percentageInput.fill(String(percentage));
      await risksPage.openActivityModalButton.click();

      const firstVisibleActivityRow = risksPage.activityModal
        .locator(
          'tbody tr[data-testid^="riesgos-profesionales-actividad-modal-option-row--"]:visible',
        )
        .first();
      await expect(firstVisibleActivityRow).toBeVisible();

      const selectedActivityId = Number(
        (await firstVisibleActivityRow.getAttribute("data-testid"))
          ?.split("--")
          .at(-1),
      );
      const selectedActivity = activities.find(
        (activity) => activity.kaNlActividad === selectedActivityId,
      );
      expect(
        selectedActivity,
        `Missing runtime lookup data for activity ID ${selectedActivityId}.`,
      ).toBeDefined();

      await firstVisibleActivityRow.click();
      await risksPage.acceptActivityButton.click();

      page.on("request", recordSaveRequest);
      const saveResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === saveUrl && response.request().method() === "POST",
      );
      await risksPage.saveButton.click();

      const saveResponse = await saveResponsePromise;
      saveSucceeded = saveResponse.ok();
      expect(saveResponse.ok()).toBe(true);
      const savePayload = saveResponse.request().postDataJSON() as {
        kaNlClase: number | null;
        scCodigo: string;
        ssClase: string;
        ndPorcentaje: number;
        kaNlActividad: number;
      };
      expect(savePayload).toEqual({
        kaNlClase: null,
        scCodigo: disposableCode,
        ssClase: className,
        ndPorcentaje: percentage,
        kaNlActividad: selectedActivityId,
      });
      expect(saveRequests).toHaveLength(1);

      const savedRecord = (await saveResponse.json()) as RiskDetail;
      expect(baselineIds.has(savedRecord.kaNlClase)).toBe(false);
      createdIds.add(savedRecord.kaNlClase);
      expect(savedRecord).toMatchObject({
        kaNlClase: savedRecord.kaNlClase,
        scCodigo: disposableCode,
        ssClase: className,
        ndPorcentaje: percentage,
        kaNlActividad: selectedActivityId,
        scCodActividad: selectedActivity!.scCodActividad,
        ssActividad: selectedActivity!.ssActividad,
      });

      // 3. Reload, capture a fresh GET /rows response, locate the record by its returned/runtime ID and code, and read /rows/{id} when detail verification is necessary.
      await page.reload();

      const reloadedRowsResponse = await page.request.get(rowsUrl, {
        headers: { authorization: authorization! },
      });
      expect(reloadedRowsResponse.ok()).toBe(true);
      const reloadedRows = (await reloadedRowsResponse.json()) as RiskRow[];
      const matchingRows = reloadedRows.filter(
        (risk) =>
          risk.kaNlClase === savedRecord.kaNlClase &&
          risk.scCodigo === disposableCode,
      );
      expect(matchingRows).toHaveLength(1);
      expect(matchingRows[0]).toMatchObject({
        ssClase: className,
        ndPorcentaje: percentage,
      });

      const detailResponse = await page.request.get(
        `${rowsUrl}/${savedRecord.kaNlClase}`,
        { headers: { authorization: authorization! } },
      );
      expect(detailResponse.ok()).toBe(true);
      expect((await detailResponse.json()) as RiskDetail).toMatchObject({
        kaNlClase: savedRecord.kaNlClase,
        scCodigo: disposableCode,
        ssClase: className,
        ndPorcentaje: percentage,
        kaNlActividad: selectedActivityId,
        scCodActividad: selectedActivity!.scCodActividad,
        ssActividad: selectedActivity!.ssActividad,
      });
    } finally {
      page.off("request", recordSaveRequest);

      // 4. Delete only the created ID and fetch /rows again.
      const currentRows =
        authorization && disposableCode !== undefined ? await readRows() : [];
      if (saveSucceeded && disposableCode !== undefined) {
        for (const risk of currentRows) {
          if (
            risk.scCodigo === disposableCode &&
            !baselineIds.has(risk.kaNlClase)
          ) {
            createdIds.add(risk.kaNlClase);
          }
        }
      }

      expect(
        createdIds.size,
        "RP-018 cleanup must target at most one test-owned record.",
      ).toBeLessThanOrEqual(1);

      if (createdIds.size === 1) {
        const [createdId] = createdIds;
        const cleanupRowsResponsePromise = page.waitForResponse(
          (response) =>
            response.url() === rowsUrl && response.request().method() === "GET",
        );
        await page.reload();
        await cleanupRowsResponsePromise;
        await locateAndSelectCreatedId(createdId);

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
        expect(deletedIds).toEqual([createdId]);
        expect(deletedIds?.some((id) => baselineIds.has(id))).toBe(false);

        const remainingRows = await readRows();
        expect(
          remainingRows.filter((risk) => risk.kaNlClase === createdId),
        ).toHaveLength(0);
      }
    }
  });
});
