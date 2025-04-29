// before: baseURL hard-coded
// import axios from "axios";

// const authApi = axios.create({
//   baseURL: "http://localhost:8000", // ← no /auth prefix
// });

// → After:

console.log("AUTH_URL →", process.env.NEXT_PUBLIC_AUTH_URL);

import axios from "axios";

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL!;
if (!AUTH_URL) {
  throw new Error("Missing NEXT_PUBLIC_AUTH_URL");
}

const authApi = axios.create({
  baseURL: `${AUTH_URL}/auth`,   // now points at /auth/*
  withCredentials: true,
});

authApi.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("token");
  if (token && cfg.headers) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

export default authApi;
