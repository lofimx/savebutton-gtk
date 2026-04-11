import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Soup from "gi://Soup";
import { logger } from "./logger.js";
import { SettingsService } from "./settings_service.js";

Gio._promisify(
  Soup.Session.prototype,
  "send_and_read_async",
  "send_and_read_finish"
);

const KAYA_PLATFORM = GLib.getenv("KAYA_PLATFORM");
const IS_MACOS = KAYA_PLATFORM === "macos";

const REDIRECT_URI = "savebutton://auth/callback";

function buildFormBody(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  email?: string;
  user_email?: string;
}

export class AuthService {
  private _settingsService: SettingsService;
  private _session: Soup.Session;
  private _accessToken: string | null = null;
  private _accessTokenExpiry: number = 0;

  constructor(settingsService: SettingsService) {
    this._settingsService = settingsService;
    this._session = new Soup.Session();
    this._session.set_proxy_resolver(null);
  }

  get accessToken(): string | null {
    if (this._accessToken && Date.now() < this._accessTokenExpiry) {
      return this._accessToken;
    }
    return null;
  }

  /**
   * Build the Bearer authorization header for API requests.
   * Refreshes the access token if expired. Returns null if not authenticated.
   */
  async getAuthHeader(): Promise<string | null> {
    let token = this.accessToken;
    if (!token) {
      token = await this.refreshAccessToken();
    }
    if (token) {
      return `Bearer ${token}`;
    }
    return null;
  }

  /**
   * Exchange email/password for JWT tokens via grant_type=password.
   * On success, stores refresh token and sets auth-method to "token".
   */
  async loginWithPassword(
    email: string,
    password: string
  ): Promise<boolean> {
    const baseUrl = this._settingsService.serverUrl.replace(/\/+$/, "");
    const url = `${baseUrl}/api/v1/auth/token`;

    logger.log(`INFO AuthService exchanging password for tokens at ${baseUrl}`);

    const body = buildFormBody({
      grant_type: "password",
      email,
      password,
      device_name: this._getDeviceName(),
      device_type: this._getDeviceType(),
      app_version: this._getAppVersion(),
    });

    const tokenResponse = await this._postTokenRequest(url, body);
    if (!tokenResponse) {
      return false;
    }

    await this._storeTokens(tokenResponse);
    return true;
  }

  /**
   * Generate PKCE params and open the browser to the authorization URL.
   * If provider is specified (e.g. 'google_oauth2', 'microsoft_graph'),
   * opens a provider-specific login page on the server.
   */
  startBrowserLogin(provider?: string): void {
    let path = "/api/v1/auth/authorize";
    if (provider) {
      path = `${path}/${provider}`;
    }
    this._openAuthorizeUrl(path);
  }

  /**
   * Open the browser to the server's registration page with PKCE params.
   */
  startBrowserRegistration(): void {
    this._openAuthorizeUrl("/api/v1/auth/authorize/register");
  }

  private _openAuthorizeUrl(path: string): void {
    const baseUrl = this._settingsService.serverUrl.replace(/\/+$/, "");
    const codeVerifier = this._generateCodeVerifier();
    this._settingsService.authPkceVerifier = codeVerifier;
    const codeChallenge = this._generateCodeChallenge(codeVerifier);

    const query = buildFormBody({
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      redirect_uri: REDIRECT_URI,
      device_name: this._getDeviceName(),
      device_type: this._getDeviceType(),
    });

    const authorizeUrl = `${baseUrl}${path}?${query}`;

    logger.log(`INFO AuthService opening browser: ${authorizeUrl}`);

    try {
      Gio.AppInfo.launch_default_for_uri(authorizeUrl, null);
    } catch (e) {
      logger.error(`Failed to open browser: ${e as string}`);
    }
  }

  /**
   * Exchange an authorization code from the OAuth callback for tokens.
   * Called when the app receives savebutton://auth/callback?code=XXX
   */
  async exchangeAuthorizationCode(code: string): Promise<boolean> {
    const codeVerifier = this._settingsService.authPkceVerifier;
    if (!codeVerifier) {
      logger.error("AuthService no code_verifier available for PKCE exchange");
      return false;
    }

    const baseUrl = this._settingsService.serverUrl.replace(/\/+$/, "");
    const url = `${baseUrl}/api/v1/auth/token`;

    logger.log("INFO AuthService exchanging authorization code for tokens");

    const body = buildFormBody({
      grant_type: "authorization_code",
      code,
      code_verifier: codeVerifier,
      redirect_uri: REDIRECT_URI,
      device_name: this._getDeviceName(),
      device_type: this._getDeviceType(),
      app_version: this._getAppVersion(),
    });

    logger.log(
      `DEBUG AuthService exchanging code at ${url}, verifier length: ${codeVerifier.length}`
    );

    const tokenResponse = await this._postTokenRequest(url, body);
    this._settingsService.authPkceVerifier = "";

    if (!tokenResponse) {
      logger.error("AuthService authorization code exchange returned no tokens");
      return false;
    }

    logger.log(
      `DEBUG AuthService got token response, user_email: ${tokenResponse.user_email || "(none)"}`
    );

    await this._storeTokens(tokenResponse);
    return true;
  }

  /**
   * Refresh the access token using the stored refresh token.
   * Returns the new access token, or null on failure.
   */
  async refreshAccessToken(): Promise<string | null> {
    const refreshToken = await this._settingsService.getRefreshToken();
    if (!refreshToken) {
      logger.log("WARN AuthService no refresh token available");
      return null;
    }

    const baseUrl = this._settingsService.serverUrl.replace(/\/+$/, "");
    const url = `${baseUrl}/api/v1/auth/token`;

    logger.log("DEBUG AuthService refreshing access token");

    const body = buildFormBody({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });

    const tokenResponse = await this._postTokenRequest(url, body);
    if (!tokenResponse) {
      logger.log(
        "WARN AuthService refresh failed, clearing token auth"
      );
      await this.clearTokenAuth();
      return null;
    }

    this._accessToken = tokenResponse.access_token;
    this._accessTokenExpiry =
      Date.now() + tokenResponse.expires_in * 1000;

    if (tokenResponse.refresh_token) {
      await this._settingsService.setRefreshToken(
        tokenResponse.refresh_token
      );
    }

    logger.log("INFO AuthService access token refreshed");
    return this._accessToken;
  }

  /**
   * Sign out: revoke the refresh token on the server, clear local state.
   */
  async signOut(): Promise<void> {
    const refreshToken = await this._settingsService.getRefreshToken();
    if (refreshToken) {
      const baseUrl = this._settingsService.serverUrl.replace(/\/+$/, "");
      const url = `${baseUrl}/api/v1/auth/revoke`;

      logger.log("INFO AuthService revoking refresh token");

      try {
        const body = buildFormBody({ refresh_token: refreshToken });
        await this._postRequest(url, body);
      } catch (e) {
        logger.error(
          `Failed to revoke refresh token on server: ${e as string}`
        );
      }
    }

    await this.clearTokenAuth();
    logger.log("INFO AuthService signed out");
  }

  /**
   * Clear all token auth state without revoking on the server.
   */
  async clearTokenAuth(): Promise<void> {
    this._accessToken = null;
    this._accessTokenExpiry = 0;
    this._settingsService.authPkceVerifier = "";
    await this._settingsService.clearRefreshToken();
    this._settingsService.authMethod = "";
    this._settingsService.authEmail = "";
    this._settingsService.syncEnabled = false;
  }

  // --- PKCE helpers ---

  _generateCodeVerifier(): string {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return this._base64urlEncode(bytes);
  }

  _generateCodeChallenge(verifier: string): string {
    const checksum = GLib.Checksum.new(GLib.ChecksumType.SHA256);
    if (!checksum) {
      throw new Error("Failed to create SHA-256 checksum");
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    checksum.update(data);

    const hexDigest = checksum.get_string();
    if (!hexDigest) {
      throw new Error("Failed to compute SHA-256 digest");
    }

    const hashBytes = new Uint8Array(hexDigest.length / 2);
    for (let i = 0; i < hashBytes.length; i++) {
      hashBytes[i] = parseInt(hexDigest.substring(i * 2, i * 2 + 2), 16);
    }

    return this._base64urlEncode(hashBytes);
  }

  _base64urlEncode(bytes: Uint8Array): string {
    const base64 = GLib.base64_encode(bytes);
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  // --- Device metadata ---

  private _getDeviceName(): string {
    return GLib.get_host_name() || "Desktop";
  }

  private _getDeviceType(): string {
    return IS_MACOS ? "desktop_macos" : "desktop_linux";
  }

  private _getAppVersion(): string {
    try {
      return pkg.version || "unknown";
    } catch {
      return "unknown";
    }
  }

  // --- HTTP helpers ---

  private async _postTokenRequest(
    url: string,
    body: string
  ): Promise<TokenResponse | null> {
    try {
      const responseText = await this._postRequest(url, body);
      const json = JSON.parse(responseText) as TokenResponse;

      if (!json.access_token) {
        logger.error("AuthService token response missing access_token");
        return null;
      }

      return json;
    } catch (e) {
      logger.error(`AuthService token request failed: ${e as string}`);
      return null;
    }
  }

  private async _postRequest(url: string, body: string): Promise<string> {
    const message = new Soup.Message({
      method: "POST",
      uri: GLib.Uri.parse(url, GLib.UriFlags.NONE),
    });

    message.request_headers.append(
      "Content-Type",
      "application/x-www-form-urlencoded"
    );

    const bodyBytes = new TextEncoder().encode(body);
    message.set_request_body_from_bytes(
      "application/x-www-form-urlencoded",
      new GLib.Bytes(bodyBytes)
    );

    const bytes = await this._session.send_and_read_async(
      message,
      GLib.PRIORITY_DEFAULT,
      null
    );

    if (
      message.status_code !== Soup.Status.OK &&
      message.status_code !== Soup.Status.CREATED
    ) {
      throw new Error(
        `HTTP ${message.status_code} ${message.reason_phrase}`
      );
    }

    const data = bytes.get_data();
    if (!data) {
      throw new Error("Empty response body");
    }

    return new TextDecoder("utf-8").decode(data);
  }

  // --- Token storage ---

  private async _storeTokens(response: TokenResponse): Promise<void> {
    this._accessToken = response.access_token;
    this._accessTokenExpiry =
      Date.now() + response.expires_in * 1000;

    await this._settingsService.setRefreshToken(response.refresh_token);

    const email =
      response.user_email ||
      response.email ||
      this._extractEmailFromJwt(response.access_token);
    this._settingsService.authMethod = "token";
    this._settingsService.authEmail = email;
    this._settingsService.syncEnabled = true;

    logger.log(
      `INFO AuthService tokens stored for ${email}`
    );
  }

  private _extractEmailFromJwt(token: string): string {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return "";

      // JWT payload is base64url encoded
      let payload = parts[1];
      payload = payload.replace(/-/g, "+").replace(/_/g, "/");
      while (payload.length % 4 !== 0) {
        payload += "=";
      }

      const decoded = GLib.base64_decode(payload);
      const text = new TextDecoder("utf-8").decode(decoded);
      const json = JSON.parse(text) as { email?: string };
      return json.email || "";
    } catch (e) {
      logger.error(`Failed to extract email from JWT: ${e as string}`);
      return "";
    }
  }
}
