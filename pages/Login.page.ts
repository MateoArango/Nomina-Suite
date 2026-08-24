import type { Locator, Page } from "@playwright/test";

export class LoginPage {
  private static readonly username = "SICOF";
  private static readonly password = "qa304";

  readonly recoveryOpenLink: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly passwordVisibilityButton: Locator;
  readonly primaryActionButton: Locator;

  constructor(readonly page: Page) {
    this.recoveryOpenLink = page.getByTestId("login-recovery-open-link");
    this.usernameInput = page.getByTestId("login-username-input");
    this.passwordInput = page.getByTestId("login-password-input");
    this.passwordVisibilityButton = page.getByTestId(
      "login-password-visibility-button",
    );
    this.primaryActionButton = page.getByTestId(
      "login-primary-action-button",
    );
  }

  async goto(): Promise<void> {
    await this.page.goto("https://nomina-qa.adacsc.co/login");
  }

  async signIn(): Promise<void> {
    await this.usernameInput.fill(LoginPage.username);
    await this.primaryActionButton.click();
    await this.passwordInput.fill(LoginPage.password);
    await this.primaryActionButton.click();
    await this.page.waitForURL(url => !url.pathname.includes("/login"));
  }
}
