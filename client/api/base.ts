import apiClient from "../config/apiClient";
import { AxiosRequestConfig } from "axios";
import { logger } from "@/utils/logger";

import type { IApiResponse } from "@/types/api/types";

export type { IApiResponse } from "@/types/api/types";

export default class BaseAPI {
  protected async makeRequest<T>(
    endpoint: string,
    options: AxiosRequestConfig = {},
  ): Promise<IApiResponse<T>> {
    try {
      const response = await apiClient({
        url: endpoint,
        ...options,
      });
      return response.data;
    } catch (error: any) {
      logger.error(
        "BaseAPI",
        `Request failed for endpoint: ${endpoint}`,
      );

      // Handle axios error structure
      if (error.response) {
        const errorMessage =
          error.response.data?.message ||
          `HTTP ${error.response.status}: ${error.response.statusText}`;
        throw Object.assign(new Error(errorMessage), { status: error.response.status });
      } else if (error.request) {
        throw new Error("Network error: No response from server");
      } else {
        throw Object.assign(new Error(error.message || "Request failed"), { status: error.status });
      }
    }
  }
}
