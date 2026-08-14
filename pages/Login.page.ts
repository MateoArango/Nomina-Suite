import type { Locator, Page } from "@playwright/test";

export class LoginPage {
  private static readonly username = "SICOF";
  private static readonly password = "qa304";

  readonly usernameInput: Locator;
  readonly continueButton: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;

  constructor(readonly page: Page) {
    this.usernameInput = page.getByRole("textbox", { name: "Usuario" });
    this.continueButton = page.getByRole("button", { name: "Continuar" });
    this.passwordInput = page.getByRole("textbox", { name: "Contraseña" });
    this.signInButton = page.getByRole("button", { name: "Ingresar" });
  }

  async goto(): Promise<void> {
    await this.page.goto("https://nomina-qa.adacsc.co/login");
  }

  async signIn(): Promise<void> {
    await this.usernameInput.fill(LoginPage.username);
    await this.continueButton.click();
    await this.passwordInput.fill(LoginPage.password);
    await this.signInButton.click();
    await this.page.waitForURL(url => !url.pathname.includes("/login"));
  }
}
