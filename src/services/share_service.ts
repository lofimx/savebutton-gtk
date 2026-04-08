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

export type ShareResult = { ok: true; shareUrl: string } | { ok: false };

export class ShareService {
  private _settingsService: SettingsService;
  private _session: Soup.Session;

  constructor(settingsService: SettingsService) {
    this._settingsService = settingsService;
    this._session = new Soup.Session();
    this._session.set_proxy_resolver(null);
  }

  static buildShareUrl(
    baseUrl: string,
    email: string,
    filename: string
  ): string {
    const encodedEmail = encodeURIComponent(email);
    const encodedFilename = encodeURIComponent(filename);
    return `${baseUrl}/api/v1/${encodedEmail}/share/anga/${encodedFilename}`;
  }

  async share(filename: string): Promise<ShareResult> {
    const baseUrl = this._settingsService.serverUrl;
    const email = this._settingsService.email;
    const password = await this._settingsService.getPassword();

    if (!password) {
      logger.log("🟠 WARN ShareService no password configured");
      return { ok: false };
    }

    const url = ShareService.buildShareUrl(baseUrl, email, filename);

    logger.log(`🔵 INFO ShareService sharing "${filename}" via ${baseUrl}`);

    const message = new Soup.Message({
      method: "POST",
      uri: GLib.Uri.parse(url, GLib.UriFlags.NONE),
    });

    const authHeader = this._createAuthHeader(email, password);
    message.request_headers.append("Authorization", authHeader);

    const bytes = await this._session.send_and_read_async(
      message,
      GLib.PRIORITY_DEFAULT,
      null
    );

    if (message.status_code !== Soup.Status.OK) {
      logger.log(
        `🟠 WARN ShareService share failed: ${message.status_code} ${message.reason_phrase}`
      );
      return { ok: false };
    }

    const data = bytes.get_data();
    if (!data) {
      logger.log("🟠 WARN ShareService empty response body");
      return { ok: false };
    }

    const decoder = new TextDecoder("utf-8");
    const responseText = decoder.decode(data);
    const json = JSON.parse(responseText) as { share_url: string };

    logger.log(`🔵 INFO ShareService share succeeded: ${json.share_url}`);

    return { ok: true, shareUrl: json.share_url };
  }

  private _createAuthHeader(email: string, password: string): string {
    const credentials = `${email}:${password}`;
    const encoded = GLib.base64_encode(new TextEncoder().encode(credentials));
    return `Basic ${encoded}`;
  }
}
