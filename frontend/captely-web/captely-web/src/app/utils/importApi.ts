import axios from "axios";

const IMPORT_URL = process.env.NEXT_PUBLIC_IMPORT_URL!;
if (!IMPORT_URL) {
  throw new Error("Missing NEXT_PUBLIC_IMPORT_URL");
}

const importApi = axios.create({
  baseURL: `${IMPORT_URL}`,   // import-service root
  withCredentials: true,
});

importApi.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("token");
  if (token && cfg.headers) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

export default importApi;
