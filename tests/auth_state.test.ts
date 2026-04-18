import { computeSignedIn } from "../src/models/auth_state";

describe("computeSignedIn", () => {
  it("returns true when authMethod is token and authEmail is present", () => {
    expect(
      computeSignedIn({ authMethod: "token", authEmail: "a@example.com" })
    ).toBe(true);
  });

  it("returns false when authMethod is token but authEmail is empty", () => {
    expect(computeSignedIn({ authMethod: "token", authEmail: "" })).toBe(false);
  });

  it("returns false for legacy basic auth (retired in clients)", () => {
    expect(
      computeSignedIn({ authMethod: "basic", authEmail: "a@example.com" })
    ).toBe(false);
    expect(computeSignedIn({ authMethod: "basic", authEmail: "" })).toBe(false);
  });

  it("returns false for an empty authMethod", () => {
    expect(
      computeSignedIn({ authMethod: "", authEmail: "a@example.com" })
    ).toBe(false);
  });
});
