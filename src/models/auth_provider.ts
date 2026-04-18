export interface ProviderIconLabel {
  icon: string;
  label: string;
}

const EMAIL: ProviderIconLabel = { icon: "mail-symbolic", label: "Email" };

const PROVIDERS: Record<string, ProviderIconLabel> = {
  google_oauth2: { icon: "icon_google", label: "Google" },
  microsoft_graph: { icon: "icon_microsoft", label: "Microsoft" },
  apple: { icon: "icon_apple", label: "Apple" },
};

export function providerIconLabel(provider: string): ProviderIconLabel {
  return PROVIDERS[provider] ?? EMAIL;
}
