import BaseAPI from "./base";
import type { IApiResponse } from "@/types/api/types";

export interface AiPrivacyPreference {
  enabled: boolean;
  disclosureVersion: string;
  updatedAt: string | null;
  providerName: string;
  privacyPolicyUrl: string | null;
}
class AiPrivacyAPI extends BaseAPI {
  get(): Promise<IApiResponse<AiPrivacyPreference>> {
    return this.makeRequest("/users/me/ai-preference");
  }
  update(value: { enabled: boolean; disclosureVersion?: string }): Promise<IApiResponse<AiPrivacyPreference>> {
    return this.makeRequest("/users/me/ai-preference", { method: "PATCH", data: value });
  }
}
export default new AiPrivacyAPI();
