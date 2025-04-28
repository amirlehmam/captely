// frontend/captely-web/utils/api.ts
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000",  // your FastAPI URL
});

// Attach token from localStorage if present
api.interceptors.request.use(config => {
  const token = localStorage.getItem("token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
