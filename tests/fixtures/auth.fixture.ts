import { expect, test as base } from "@playwright/test";
import { LoginPage } from "../../pages/Login.page";

type AuthFixtures = {
  authenticated: void;
};

const disableAnimationsCss = `
  *,
  *::before,
  *::after {
    animation-delay: 0s !important;
    animation-duration: 0s !important;
    transition-delay: 0s !important;
    transition-duration: 0s !important;
    scroll-behavior: auto !important;
  }
`;

export const test = base.extend<AuthFixtures>({
  authenticated: [
    async ({ page }, use) => {
      await page.addInitScript(css => {
        const style = document.createElement("style");
        style.dataset.playwrightDisableAnimations = "true";
        style.textContent = css;
        document.documentElement.appendChild(style);
      }, disableAnimationsCss);

      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.signIn();
      await use();
    },
    { auto: true },
  ],
});

export { expect };
