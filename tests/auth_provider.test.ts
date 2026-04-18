import { providerIconLabel } from "../src/models/auth_provider";

describe("providerIconLabel", () => {
  it("maps google_oauth2 to the Google brand icon", () => {
    expect(providerIconLabel("google_oauth2")).toStrictEqual({
      icon: "icon_google",
      label: "Google",
    });
  });

  it("maps microsoft_graph to the Microsoft brand icon", () => {
    expect(providerIconLabel("microsoft_graph")).toStrictEqual({
      icon: "icon_microsoft",
      label: "Microsoft",
    });
  });

  it("maps apple to the Apple brand icon", () => {
    expect(providerIconLabel("apple")).toStrictEqual({
      icon: "icon_apple",
      label: "Apple",
    });
  });

  it("maps empty string (grant_type=password) to Email", () => {
    expect(providerIconLabel("")).toStrictEqual({
      icon: "mail-symbolic",
      label: "Email",
    });
  });

  it("maps unknown providers to Email", () => {
    expect(providerIconLabel("wat")).toStrictEqual({
      icon: "mail-symbolic",
      label: "Email",
    });
  });
});
