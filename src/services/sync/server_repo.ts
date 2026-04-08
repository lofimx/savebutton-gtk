import GLib from "gi://GLib";
import Soup from "gi://Soup";

const MIME_TYPES: Record<string, string> = {
  md: "text/markdown",
  url: "text/plain",
  txt: "text/plain",
  json: "application/json",
  toml: "application/toml",
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  html: "text/html",
  htm: "text/html",
};

export class ServerRepo {
  private _session: Soup.Session;
  private _baseUrl: string;
  private _email: string;
  private _password: string;
  private _encodedEmail: string;

  constructor(
    session: Soup.Session,
    baseUrl: string,
    email: string,
    password: string
  ) {
    this._session = session;
    this._baseUrl = baseUrl;
    this._email = email;
    this._password = password;
    this._encodedEmail = encodeURIComponent(email);
  }

  async fetchList(resource: string): Promise<string[]> {
    const url = `${this._baseUrl}/api/v1/${this._encodedEmail}/${resource}`;

    const bytes = await this._get(url);

    const decoder = new TextDecoder("utf-8");
    const data = bytes.get_data();
    if (!data) {
      throw new Error(
        `Failed to get data from server response for ${resource}`
      );
    }

    const response = decoder.decode(data);
    return response
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
  }

  async download(resource: string, filename: string): Promise<Uint8Array> {
    const encodedFilename = encodeURIComponent(filename);
    const url = `${this._baseUrl}/api/v1/${this._encodedEmail}/${resource}/${encodedFilename}`;

    const bytes = await this._get(url);

    const data = bytes.get_data();
    if (!data) {
      throw new Error(`Failed to get data for file: ${filename}`);
    }

    return data;
  }

  async upload(
    resource: string,
    filename: string,
    contents: Uint8Array,
    contentType: string
  ): Promise<void> {
    const encodedFilename = encodeURIComponent(filename);
    const url = `${this._baseUrl}/api/v1/${this._encodedEmail}/${resource}/${encodedFilename}`;

    const boundary = `----KayaSyncBoundary${GLib.uuid_string_random()}`;

    const bodyParts: string[] = [];
    bodyParts.push(`--${boundary}`);
    bodyParts.push(
      `Content-Disposition: form-data; name="file"; filename="${filename}"`
    );
    bodyParts.push(`Content-Type: ${contentType}`);
    bodyParts.push("");

    const headerBytes = new TextEncoder().encode(
      bodyParts.join("\r\n") + "\r\n"
    );
    const footerBytes = new TextEncoder().encode(`\r\n--${boundary}--\r\n`);

    const fullBody = new Uint8Array(
      headerBytes.length + contents.length + footerBytes.length
    );
    fullBody.set(headerBytes, 0);
    fullBody.set(contents, headerBytes.length);
    fullBody.set(footerBytes, headerBytes.length + contents.length);

    const message = new Soup.Message({
      method: "POST",
      uri: GLib.Uri.parse(url, GLib.UriFlags.NONE),
    });

    message.request_headers.append("Authorization", this._createAuthHeader());
    message.request_headers.append(
      "Content-Type",
      `multipart/form-data; boundary=${boundary}`
    );

    message.set_request_body_from_bytes(
      `multipart/form-data; boundary=${boundary}`,
      new GLib.Bytes(fullBody)
    );

    const bytes = await this._session.send_and_read_async(
      message,
      GLib.PRIORITY_DEFAULT,
      null
    );

    if (
      message.status_code !== Soup.Status.CREATED &&
      message.status_code !== Soup.Status.OK &&
      message.status_code !== 409 &&
      message.status_code !== 422
    ) {
      throw new Error(`${message.status_code} ${message.reason_phrase}`);
    }

    void bytes;
  }

  mimeTypeFor(filename: string): string {
    const ext = filename.toLowerCase().split(".").pop() || "";
    return MIME_TYPES[ext] || "application/octet-stream";
  }

  private async _get(url: string): Promise<GLib.Bytes> {
    const message = new Soup.Message({
      method: "GET",
      uri: GLib.Uri.parse(url, GLib.UriFlags.NONE),
    });

    message.request_headers.append("Authorization", this._createAuthHeader());

    const bytes = await this._session.send_and_read_async(
      message,
      GLib.PRIORITY_DEFAULT,
      null
    );

    if (message.status_code !== Soup.Status.OK) {
      throw new Error(`${message.status_code} ${message.reason_phrase}`);
    }

    return bytes;
  }

  private _createAuthHeader(): string {
    const credentials = `${this._email}:${this._password}`;
    const encoded = GLib.base64_encode(new TextEncoder().encode(credentials));
    return `Basic ${encoded}`;
  }
}
