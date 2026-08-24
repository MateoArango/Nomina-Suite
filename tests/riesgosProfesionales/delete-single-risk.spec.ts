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
};

const pageUrl = "https://nomina-qa.adacsc.co/riesgos-profesionales";
const rowsUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/rows";
const saveUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/actions/grabar";
const deleteUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/actions/borrar";

test.describe("CRUD persistence and safe deletion", () => {
  test("RP-022: Delete one disposable record and verify request scope", async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);

    const risksPage = new RiesgosProfesionalesPage(page);
    const className = "RP-022 DELETE";
    const percentage = 22.022;
    const baselineIds = new Set<number>();
    let disposableCode: string | undefined;
    let createdId: number | undefined;
    let deletionCompleted = false;

    const readRows = async (): Promise<RiskRow[]> => {
      const response = await page.request.get(rowsUrl);
      expect(response.ok()).toBe(true);
      return (await response.json()) as RiskRow[];
    };

    const selectOnlyId = async (id: number): Promise<void> => {
      await risksPage.pageSizeButton(100).click();

      while (!(await risksPage.previousPageButton.isDisabled())) {
        await risksPage.previousPageButton.click();
      }

      while (true) {
        const checkbox = risksPage.riskCheckbox(id);
        if ((await checkbox.count()) === 1 && (await checkbox.isVisible())) {
          await checkbox.check();
          return;
        }

        if (await risksPage.nextPageButton.isDisabled()) {
          throw new Error(
            `Unable to find RP-022 test-owned occupational-risk ID ${id}.`,
          );
        }

        await risksPage.nextPageButton.click();
      }
    };

    const confirmDeleteIfPresented = async (): Promise<void> => {
      const confirmationPresented = await risksPage.deleteConfirmButton
        .waitFor({ state: "visible", timeout: 2_000 })
        .then(() => true)
        .catch(() => false);

      if (confirmationPresented) {
        await risksPage.deleteConfirmButton.click();
      }
    };

    const deleteRequests: Request[] = [];
    const recordDeleteRequest = (request: Request): void => {
      if (request.method() === "POST" && request.url() === deleteUrl) {
        deleteRequests.push(request);
      }
    };

    try {
      // 1. Create one disposable record, reload, and select only its ID-scoped checkbox.
      const initialRowsResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === rowsUrl && response.request().method() === "GET",
      );
      await page.goto(pageUrl);
      const initialRowsResponse = await initialRowsResponsePromise;
      expect(initialRowsResponse.ok()).toBe(true);

      const initialRows = (await initialRowsResponse.json()) as RiskRow[];
      initialRows.forEach((risk) => baselineIds.add(risk.kaNlClase));

      const usedCodes = new Set(
        initialRows.map((risk) => String(risk.scCodigo).toUpperCase()),
      );
      const candidateOffset = (Date.now() + testInfo.workerIndex) % (36 * 36);

      for (let attempt = 0; attempt < 36 * 36; attempt += 1) {
        const candidate = `X${((candidateOffset + attempt) % (36 * 36))
          .toString(36)
          .toUpperCase()
          .padStart(2, "0")}`;

        if (!usedCodes.has(candidate)) {
          disposableCode = candidate;
          break;
        }
      }

      test.skip(
        disposableCode === undefined,
        "RP-022 requires one unused X00-XZZ code.",
      );

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
      expect(Number.isInteger(selectedActivityId)).toBe(true);

      await firstVisibleActivityRow.click();
      await risksPage.acceptActivityButton.click();

      const createResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === saveUrl && response.request().method() === "POST",
      );
      await risksPage.saveButton.click();

      const createResponse = await createResponsePromise;
      expect(createResponse.ok()).toBe(true);
      expect(createResponse.request().postDataJSON()).toEqual({
        kaNlClase: null,
        scCodigo: disposableCode,
        ssClase: className,
        ndPorcentaje: percentage,
        kaNlActividad: selectedActivityId,
      });

      const createdRecord = (await createResponse.json()) as RiskDetail;
      createdId = createdRecord.kaNlClase;
      expect(baselineIds.has(createdId)).toBe(false);
      expect(createdRecord).toMatchObject({
        scCodigo: disposableCode,
        ssClase: className,
        ndPorcentaje: percentage,
        kaNlActividad: selectedActivityId,
      });

      const reloadedRowsResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === rowsUrl && response.request().method() === "GET",
      );
      await page.reload();
      const reloadedRowsResponse = await reloadedRowsResponsePromise;
      expect(reloadedRowsResponse.ok()).toBe(true);
      const reloadedRows = await readRows();
      expect(
        reloadedRows.filter(
          (risk) =>
            risk.kaNlClase === createdId && risk.scCodigo === disposableCode,
        ),
      ).toHaveLength(1);

      const checkedCheckboxes = risksPage.riskTable.locator(
        'input[data-testid^="riesgos-profesionales-table-select-checkbox--"]:checked',
      );
      await expect(checkedCheckboxes).toHaveCount(0);
      await selectOnlyId(createdId);

      await expect(risksPage.riskCheckbox(createdId)).toBeChecked();
      await expect(checkedCheckboxes).toHaveCount(1);
      await expect(risksPage.deleteButton).toBeEnabled();

      // 2. Start waiting for POST /actions/borrar and click Delete Selected; handle a confirmation only if the current UI presents one.
      page.on("request", recordDeleteRequest);
      const deleteResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === deleteUrl &&
          response.request().method() === "POST",
      );
      await risksPage.deleteButton.click();
      await confirmDeleteIfPresented();

      const deleteResponse = await deleteResponsePromise;
      expect(deleteResponse.ok()).toBe(true);
      expect(deleteRequests).toHaveLength(1);

      const deletePayload = deleteResponse.request().postDataJSON() as {
        ids?: number[];
      };
      expect(deletePayload.ids).toEqual([createdId]);
      expect(
        deletePayload.ids?.some((id) => baselineIds.has(id)),
      ).toBe(false);
      deletionCompleted = true;
      page.off("request", recordDeleteRequest);

      // 3. Reload and capture a fresh GET /rows response.
      const finalRowsResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === rowsUrl && response.request().method() === "GET",
      );
      await page.reload();
      const finalRowsResponse = await finalRowsResponsePromise;
      expect(finalRowsResponse.ok()).toBe(true);

      const finalRows = await readRows();
      expect(
        finalRows.filter((risk) => risk.kaNlClase === createdId),
      ).toHaveLength(0);
      expect(deletePayload.ids).toEqual([createdId]);
      expect(
        deletePayload.ids?.some((id) => baselineIds.has(id)),
      ).toBe(false);
    } finally {
      page.off("request", recordDeleteRequest);

      if (!deletionCompleted && disposableCode !== undefined) {
        const currentRows = await readRows();
        const remainingTestOwnedIds = new Set(
          currentRows
            .filter(
              (risk) =>
                risk.scCodigo === disposableCode &&
                !baselineIds.has(risk.kaNlClase),
            )
            .map((risk) => risk.kaNlClase),
        );

        expect(
          remainingTestOwnedIds.size,
          "RP-022 failure-safe cleanup must target at most one test-owned record.",
        ).toBeLessThanOrEqual(1);

        if (remainingTestOwnedIds.size === 1) {
          const [remainingId] = remainingTestOwnedIds;
          const cleanupRowsResponsePromise = page.waitForResponse(
            (response) =>
              response.url() === rowsUrl &&
              response.request().method() === "GET",
          );
          await page.reload();
          await cleanupRowsResponsePromise;
          await selectOnlyId(remainingId);

          const cleanupDeleteResponsePromise = page.waitForResponse(
            (response) =>
              response.url() === deleteUrl &&
              response.request().method() === "POST",
          );
          await risksPage.deleteButton.click();
          await confirmDeleteIfPresented();

          const cleanupDeleteResponse = await cleanupDeleteResponsePromise;
          expect(cleanupDeleteResponse.ok()).toBe(true);
          const cleanupIds = (
            cleanupDeleteResponse.request().postDataJSON() as {
              ids?: number[];
            }
          ).ids;
          expect(cleanupIds).toEqual([remainingId]);
          expect(cleanupIds?.some((id) => baselineIds.has(id))).toBe(false);
        }
      }
    }
  });
});
