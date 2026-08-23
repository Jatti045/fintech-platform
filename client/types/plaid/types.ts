// ─── Plaid Domain Types ───────────────────────────────────────────────────

/** Health status of a linked bank connection. */
export type PlaidItemStatus = "ACTIVE" | "REQUIRES_REAUTH";

/** Shape returned by our backend `/plaid/link-token` endpoint. */
export interface ILinkTokenResponse {
  linkToken: string;
}

/** Non-sensitive summary of a persisted Plaid item (incl. health fields). */
export interface IPlaidItem {
  id: string;
  itemId: string;
  institutionName: string | null;
  createdAt: string;
  /** ACTIVE, or REQUIRES_REAUTH when Plaid reported ITEM_LOGIN_REQUIRED. */
  status: PlaidItemStatus;
  /** True when the last transaction sync failed; cleared on success. */
  syncError: boolean;
  /** ISO timestamp of the last successful sync, or null if never synced. */
  lastSyncedAt: string | null;
  /** ISO timestamp ITEM_LOGIN_REQUIRED was received, or null. */
  reauthRequestedAt: string | null;
}

/** Result of exchanging the Public Token returned by the Plaid Link SDK. */
export interface IPlaidExchangeResponse {
  item: IPlaidItem;
}

/** List of active bank connections returned by `GET /plaid/items`. */
export interface IPlaidItemsResponse {
  items: IPlaidItem[];
}

/** Result of `DELETE /plaid/items/{itemId}`. */
export interface IDisconnectItemResponse {
  deletedItemId: string;
}

/** Body for `POST /plaid/link-token/update`. */
export interface IUpdateLinkTokenRequest {
  itemId: string;
}

/** Body for `POST /plaid/items/reauth-complete`. */
export interface IReauthCompleteRequest {
  itemId: string;
}

/** Result of `POST /plaid/items/reauth-complete`. */
export interface IReauthCompleteResponse {
  itemId: string;
  status: PlaidItemStatus;
}

/** Result of `POST /plaid/sync/{itemId}`. */
export interface IManualSyncResponse {
  itemId: string;
}

