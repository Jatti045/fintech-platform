import BaseAPI from "./base";

class TransactionClassificationAPI extends BaseAPI {
  reset(id: string, automatic = false) {
    return this.makeRequest(`/transactions/${id}/classification/reset`, {
      method: "POST",
      params: { automatic },
    });
  }
}

export default new TransactionClassificationAPI();
