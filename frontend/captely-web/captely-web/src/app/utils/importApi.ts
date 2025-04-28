// src/app/utils/importApi.ts
import axios from "axios";

const importApi = axios.create({
  baseURL: "http://localhost:8002",            // Import service (docker: 8002→8000)
});

importApi.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("token");
  if (token && cfg.headers) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

export default importApi;
