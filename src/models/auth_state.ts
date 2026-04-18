export interface AuthStateInput {
  authMethod: string;
  authEmail: string;
}

/**
 * "Signed in" means the client holds a JWT token pair (refresh token in the
 * keyring, plus `authMethod === "token"` and a non-empty `authEmail` in
 * GSettings). Basic Auth is retired in all clients other than savebutton-web.
 *
 * The invariant that lets this be synchronous-safe is: AuthService._storeTokens
 * and AuthService.clearTokenAuth update authMethod, authEmail, and the refresh
 * token together. Settings never drift from keyring for the UI hot path.
 */
export function computeSignedIn({ authMethod, authEmail }: AuthStateInput): boolean {
  return authMethod === "token" && authEmail !== "";
}
