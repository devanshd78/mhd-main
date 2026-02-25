// lib/api/axios.ts
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

// API 1 (existing)
const api: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { "Content-Type": "application/json" },
});

// ✅ API 2 (new)
export const api2: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL2,
  headers: { "Content-Type": "application/json" },
});

// Convenience wrappers for API 1
export const get = <T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
  return api.get<T>(url, config);
};

export const post = <T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
  return api.post<T>(url, data, config);
};

// ✅ Convenience wrappers for API 2
export const get2 = <T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
  return api2.get<T>(url, config);
};

export const post2 = <T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
  return api2.post<T>(url, data, config);
};

export default api;