// src/app/utils/authApi.ts
import axios from "axios";

const authApi = axios.create({
  baseURL: "http://localhost:8000",            // Auth service
});

authApi.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("token");
  if (token && cfg.headers) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

export default authApi;
