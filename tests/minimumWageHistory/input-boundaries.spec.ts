// spec: specs/minimum-wage-history-plan.md
// seed: tests/minimumWageHistory/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { MinimumWageHistoryPage } from "../../pages/MinimumWageHistory.page";

type MinimumWageHistoryRow = {
  vigencia: number;
};

type MinimumWageHistoryDetail = {
  vigencia: number;
  ndSubsidioAlimentacion: number | null;
};

const applicationUrl =
  "https://nomina-qa.adacsc.co/mae-historico-salario-minimo";
const modulePath = "/api/v1/w-mae-historico-salario-minimo";
const rowsPath = `${modulePath}/rows`;
const relationshipPath = `${modulePath}/actions/validar-relacion`;
const extremelyLongDigits = "9".repeat(100);

test.describe("Client-only edit, undo, and dirty-navigation behavior", () => {
  test("MWH-013: Latest-year number-input entry boundaries are explicit client contracts", async ({
    page,
  }) => {
    const minimumWageHistoryPage = new MinimumWageHistoryPage(page);
    const mutationRequests: string[] = [];

    page.on("request", request => {
      const url = new URL(request.url());

      if (
        !["GET", "HEAD", "OPTIONS"].includes(request.method()) &&
        url.pathname.startsWith(modulePath)
      ) {
        mutationRequests.push(request.url());
      }
    });

    const rowsResponsePromise = page.waitForResponse(response => {
      const url = new URL(response.url());

      return (
        response.request().method() === "GET" &&
        url.pathname === rowsPath
      );
    });
    const initialRelationshipResponsePromise = page.waitForResponse(
      response => {
        const url = new URL(response.url());

        return (
          response.request().method() === "GET" &&
          url.pathname === relationshipPath &&
          url.searchParams.get("tipo") === "1"
        );
      },
    );

    await page.goto(applicationUrl);

    const [rowsResponse, initialRelationshipResponse] = await Promise.all([
      rowsResponsePromise,
      initialRelationshipResponsePromise,
    ]);

    expect(rowsResponse.ok()).toBe(true);
    expect(initialRelationshipResponse.ok()).toBe(true);

    const runtimeRows =
      (await rowsResponse.json()) as MinimumWageHistoryRow[];
    expect(
      runtimeRows.length,
      "MWH-013 needs at least one runtime row",
    ).toBeGreaterThan(0);

    const runtimeYears = runtimeRows.map(row => row.vigencia);
    expect(runtimeYears).toEqual(
      runtimeRows.map(() => expect.any(Number)),
    );
    expect(new Set(runtimeYears).size).toBe(runtimeRows.length);

    const latestYear = Math.max(...runtimeYears);
    const baselineMutationRequestCount = mutationRequests.length;
    let baselineSubsidy: number | null | undefined;

    const boundaryAttempts = [
      {
        name: "letters and symbols",
        keys: "abc!@#",
        expectedValue: "",
      },
      {
        name: "multiple decimal points",
        keys: "1.2.3",
        expectedValue: "1.23",
      },
      {
        name: "an extremely long digit string",
        keys: extremelyLongDigits,
        expectedValue: "",
      },
      {
        name: "an empty value",
        keys: null,
        expectedValue: "",
      },
    ] as const;

    // 1. In separate fresh-state iterations, attempt letters/symbols, multiple decimal points, an extremely long digit string, and an empty value in the latest-year Subsidio alimentación input; do not click Guardar.
    for (const attempt of boundaryAttempts) {
      await test.step(attempt.name, async () => {
        const selectionValidationResponsePromise = page.waitForResponse(
          response => {
            const url = new URL(response.url());

            return (
              response.request().method() === "GET" &&
              url.pathname === relationshipPath &&
              url.searchParams.get("vigencia") === String(latestYear) &&
              url.searchParams.get("tipo") === "1"
            );
          },
        );

        await minimumWageHistoryPage.row(latestYear).click();

        const selectionValidationResponse =
          await selectionValidationResponsePromise;
        expect(selectionValidationResponse.ok()).toBe(true);

        const detailValidationResponsePromise = page.waitForResponse(
          response => {
            const url = new URL(response.url());

            return (
              response.request().method() === "GET" &&
              url.pathname === relationshipPath &&
              url.searchParams.get("vigencia") === String(latestYear) &&
              url.searchParams.get("tipo") === "3"
            );
          },
        );
        const detailResponsePromise = page.waitForResponse(response => {
          const url = new URL(response.url());

          return (
            response.request().method() === "GET" &&
            url.pathname === `${rowsPath}/${latestYear}`
          );
        });

        await minimumWageHistoryPage.detailTab.click();

        const [detailValidationResponse, detailResponse] =
          await Promise.all([
            detailValidationResponsePromise,
            detailResponsePromise,
          ]);

        expect(detailValidationResponse.ok()).toBe(true);
        expect(detailResponse.ok()).toBe(true);

        const detail =
          (await detailResponse.json()) as MinimumWageHistoryDetail;
        expect(detail.vigencia).toBe(latestYear);

        if (baselineSubsidy === undefined) {
          baselineSubsidy = detail.ndSubsidioAlimentacion;
        } else {
          expect(detail.ndSubsidioAlimentacion).toBe(baselineSubsidy);
        }

        const originalValue =
          detail.ndSubsidioAlimentacion === null
            ? ""
            : String(detail.ndSubsidioAlimentacion);

        await expect(
          minimumWageHistoryPage.detailFoodSubsidyInput,
        ).toHaveValue(originalValue);
        await expect(minimumWageHistoryPage.saveButton).toBeEnabled();

        await minimumWageHistoryPage.detailFoodSubsidyInput.click();
        await page.keyboard.press("Control+A");

        if (attempt.keys === null) {
          await page.keyboard.press("Backspace");
        } else {
          await minimumWageHistoryPage.detailFoodSubsidyInput.pressSequentially(
            attempt.keys,
          );
        }

        await expect(
          minimumWageHistoryPage.detailFoodSubsidyInput,
        ).toHaveValue(attempt.expectedValue);
        await expect(minimumWageHistoryPage.saveButton).toBeEnabled();
        expect(mutationRequests).toHaveLength(
          baselineMutationRequestCount,
        );

        await minimumWageHistoryPage.undoButton.click();

        await expect(minimumWageHistoryPage.listTab).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await expect(minimumWageHistoryPage.detailTab).toHaveAttribute(
          "aria-selected",
          "false",
        );
        await expect(
          minimumWageHistoryPage.detailFoodSubsidyInput,
        ).toHaveCount(0);
        await expect(minimumWageHistoryPage.saveButton).toBeDisabled();
        await expect(minimumWageHistoryPage.undoButton).toBeDisabled();

        const pageLocale =
          (await page.locator("html").getAttribute("lang")) || "en-US";
        const formattedBaselineSubsidy =
          detail.ndSubsidioAlimentacion === null
            ? ""
            : new Intl.NumberFormat(pageLocale, {
                maximumFractionDigits: 20,
              }).format(detail.ndSubsidioAlimentacion);

        await expect(
          minimumWageHistoryPage
            .row(latestYear)
            .locator("td")
            .nth(3),
        ).toHaveText(formattedBaselineSubsidy);
        expect(mutationRequests).toHaveLength(
          baselineMutationRequestCount,
        );
      });
    }
  });
});
