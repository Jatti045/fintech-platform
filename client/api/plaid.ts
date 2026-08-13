import BaseAPI from "./base";
import type { IApiResponse } from "@/types/api/types";
import type {
  ILinkTokenResponse,
  IPlaidExchangeResponse,
  IPlaidItemsResponse,
  IDisconnectItemResponse,
} from "@/types/plaid/types";

export type {
  ILinkTokenResponse,
  IPlaidExchangeResponse,
  IPlaidItemsResponse,
  IDisconnectItemResponse,
};

/**
 * Thin client for the backend Plaid endpoints.
 *
 * The mobile app never holds the Plaid secret: it fetches a scoped
 * `link_token`, runs the native Plaid Link flow, and returns the resulting
 * `public_token` to the backend for exchange. Connected items are listed via
 * `GET /plaid/items` and removed via `DELETE /plaid/items/{itemId}`.
 */
class PlaidAPI extends BaseAPI {
  async createLinkToken(): Promise<IApiResponse<ILinkTokenResponse>> {
    return this.makeRequest("/plaid/link-token", { method: "POST" });
  }

  async exchangePublicToken(
    publicToken: string,
  ): Promise<IApiResponse<IPlaidExchangeResponse>> {
    return this.makeRequest("/plaid/token", {
      method: "POST",
      data: { publicToken },
    });
  }

  /** Lists the active bank connections for the authenticated user. */
  async fetchItems(): Promise<IApiResponse<IPlaidItemsResponse>> {
    return this.makeRequest("/plaid/items", { method: "GET" });
  }

  /** Revokes the Plaid item and removes it from the user's profile. */
  async disconnectItem(itemId: string): Promise<IApiResponse<IDisconnectItemResponse>> {
    return this.makeRequest(`/plaid/items/${itemId}`, { method: "DELETE" });
  }
}

export const plaidAPI = new PlaidAPI();
export default plaidAPI;
