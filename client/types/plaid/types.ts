// ─── Plaid Domain Types ───────────────────────────────────────────────────

/** Shape returned by our backend `/plaid/link-token` endpoint. */
export interface ILinkTokenResponse {
  linkToken: string;
}

/** Non-sensitive summary of a persisted Plaid item. */
export interface IPlaidItem {
  id: string;
  itemId: string;
  institutionName: string | null;
  createdAt: string;
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

