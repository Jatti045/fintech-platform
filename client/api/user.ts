import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient from "../config/apiClient";
import BaseAPI from "./base";
import type { IApiResponse } from "@/types/api/types";
import {
  AUTH_TOKEN_STORAGE_KEY,
  USER_DATA_STORAGE_KEY,
} from "@/constants/storageKeys";
import {
  getAuthToken,
  setAuthToken,
} from "@/utils/secureStorage";
import { establishSession, invalidateSession, getSessionIdentity } from "@/utils/session";
import { logger } from "@/utils/logger";
import {
  type ILoginData,
  type ISignupData,
  type IUser,
  type IAuthResponse,
} from "@/types/user/types";

export type { ILoginData, ISignupData, IUser, IAuthResponse };

class UserAPI extends BaseAPI {
  async hasAnyTransactions(): Promise<boolean> {
    const response = await this.makeRequest<any>("/transaction", {
      method: "GET",
      params: { page: 1, limit: 1 },
    });

    const totalCount = Number(response?.data?.pagination?.totalCount ?? 0);
    return totalCount > 0;
  }

  async login(
    credentials: ILoginData,
  ): Promise<IApiResponse<{ user: IUser; token: string }>> {
    const response = await this.makeRequest<{ user: IUser; token: string }>(
      "/auth/login",
      { method: "POST", data: credentials },
    );

    await establishSession(response.data.token, response.data.user);

    return response;
  }

  async signup(userData: ISignupData): Promise<IApiResponse<any>> {
    return this.makeRequest<any>("/auth/register", {
      method: "POST",
      data: userData,
    });
  }

  async logout(): Promise<void> {
    await invalidateSession();
  }

  async deleteAccount(userId: string): Promise<IApiResponse<IUser>> {
    const identity = await getSessionIdentity();
    const response = await this.makeRequest<IUser>(`/users/${userId}`, {
      method: "DELETE",
    });
    await invalidateSession(identity);
    return response;
  }

  async uploadProfilePictureById(
    userId: string,
    imageFile: any,
  ): Promise<IApiResponse<IUser>> {
    const formData = new FormData();
    formData.append("profilePicture", imageFile);

    const response = await apiClient.post(
      `/users/${userId}/profile-picture`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );

    if (response?.data?.data) {
      await AsyncStorage.setItem(
        USER_DATA_STORAGE_KEY,
        JSON.stringify(response.data.data),
      );
    }

    return response.data;
  }

  async deleteProfilePictureById(userId: string): Promise<IApiResponse<IUser>> {
    const response = await this.makeRequest<IUser>(
      `/users/${userId}/profile-picture`,
      { method: "DELETE" },
    );

    if (response?.data) {
      try {
        await AsyncStorage.setItem(
          USER_DATA_STORAGE_KEY,
          JSON.stringify(response.data),
        );
      } catch (error) {
        logger.warn(
          "UserAPI",
          "Failed to persist profile picture deletion",
          error,
        );
      }
    }

    return response;
  }

  async changePassword(payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<IApiResponse<any>> {
    return this.makeRequest<any>("/users/me/password", {
      method: "PATCH",
      data: payload,
    });
  }

  async forgotPassword(email: { email: string }): Promise<IApiResponse<any>> {
    return this.makeRequest<any>("/auth/forgot-password", {
      method: "POST",
      data: email,
    });
  }

  async resetPassword(payload: {
    email: string;
    otp: string;
    newPassword?: string;
    confirmPassword?: string;
    verifyOnly?: boolean;
  }): Promise<IApiResponse<any>> {
    return this.makeRequest<any>("/auth/reset-password", {
      method: "POST",
      data: payload,
    });
  }

  async updateCurrency(currency: string): Promise<IApiResponse<IUser>> {
    const response = await this.makeRequest<IUser>("/users/me/currency", {
      method: "PATCH",
      data: { currency },
    });

    if (response?.data) {
      try {
        await AsyncStorage.setItem(
          USER_DATA_STORAGE_KEY,
          JSON.stringify(response.data),
        );
      } catch (error) {
        logger.warn("UserAPI", "Failed to persist updated currency", error);
      }
    }

    return response;
  }

  async updateMonthlyIncome(
    {
      monthlyIncome,
      month,
      year,
    }: {
      monthlyIncome: number;
      month: number;
      year: number;
    },
  ): Promise<IApiResponse<IUser>> {
    const response = await this.makeRequest<IUser>("/users/me/monthly-income", {
      method: "PATCH",
      data: { monthlyIncome, month, year },
    });

    if (response?.data) {
      try {
        await AsyncStorage.setItem(
          USER_DATA_STORAGE_KEY,
          JSON.stringify(response.data),
        );
      } catch (error) {
        logger.warn("UserAPI", "Failed to persist monthly income", error);
      }
    }

    return response;
  }

  async getMonthlyIncome({
    month,
    year,
  }: {
    month: number;
    year: number;
  }): Promise<IApiResponse<IUser>> {
    return this.makeRequest<IUser>("/users/me/monthly-income", {
      method: "GET",
      params: { month, year },
    });
  }

  // Utility Methods
  async getStoredToken(): Promise<string | null> {
    try {
      const token = await getAuthToken();
      if (token) {
        return token;
      }

      // Legacy fallback path: migrate old AsyncStorage token into secure storage.
      const legacyToken = await AsyncStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
      if (legacyToken) {
        await setAuthToken(legacyToken);
        await AsyncStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        return legacyToken;
      }

      return null;
    } catch (error) {
      logger.warn("UserAPI", "Failed to read token from storage", error);
      return null;
    }
  }

  async getStoredUser(): Promise<IUser | null> {
    try {
      const userData = await AsyncStorage.getItem(USER_DATA_STORAGE_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      logger.warn("UserAPI", "Failed to read user profile from storage", error);
      return null;
    }
  }

  async googleAuth(idToken: string): Promise<IApiResponse<{user: IUser, token: string}>> {
    const response =  await this.makeRequest<{user: IUser, token: string}>(
        '/auth/google',
        {
          method: "POST",
          data: {idToken},
        }
    )

    console.log("Google auth: ", response)

    await establishSession(response.data.token, response.data.user);

    return response
  }
}

// Export singleton instance
export const userAPI = new UserAPI();

