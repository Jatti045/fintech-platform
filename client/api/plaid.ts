import BaseAPI from "./base";
import type { IApiResponse } from "@/types/api/types";
import type {
  ILinkTokenResponse,
  IPlaidExchangeResponse,
  IPlaidItemsResponse,
  IDisconnectItemResponse,
  IReauthCompleteResponse,
  IManualSyncResponse,
} from "@/types/plaid/types";

export type {
  ILinkTokenResponse,
  IPlaidExchangeResponse,
  IPlaidItemsResponse,
  IDisconnectItemResponse,
  IReauthCompleteResponse,
  IManualSyncResponse,
};

/**
 * Thin client for the backend Plaid endpoints.
 *
 * The mobile app never holds the Plaid secret: it fetches a scoped
 * `link_token`, runs the native Plaid Link flow, and returns the resulting
 * `public_token` to the backend for exchange. Connected items are listed via
 * `GET /plaid/items` and removed via `DELETE /plaid/items/{itemId}`. Update
 * mode re-authentication reuses the existing item (no public-token exchange).
 */
class PlaidAPI extends BaseAPI {
  async createLinkToken(): Promise<IApiResponse<ILinkTokenResponse>> {
    return this.makeRequest("/plaid/link-token", { method: "POST" });
  }

  /**
   * Creates an update-mode Link token for an existing item. The backend reuses
   * the stored access_token and does NOT exchange a new public token after the
   * user completes re-auth.
   */
  async createUpdateLinkToken(
    itemId: string,
  ): Promise<IApiResponse<ILinkTokenResponse>> {
    return this.makeRequest("/plaid/link-token/update", {
      method: "POST",
      data: { itemId },
    });
  }

  /**
   * Clears the REQUIRES_REAUTH flag after the user completes update mode and
   * triggers a transaction sync for the item.
   */
  async reauthComplete(
    itemId: string,
  ): Promise<IApiResponse<IReauthCompleteResponse>> {
    return this.makeRequest("/plaid/items/reauth-complete", {
      method: "POST",
      data: { itemId },
    });
  }

  /** Manually triggers a transaction sync for the given item. */
  async triggerManualSync(
    itemId: string,
  ): Promise<IApiResponse<IManualSyncResponse>> {
    return this.makeRequest(`/plaid/sync/${itemId}`, { method: "POST" });
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
