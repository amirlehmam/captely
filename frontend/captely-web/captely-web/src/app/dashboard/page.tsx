"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import authApi from "../utils/authApi";

type ApiKey = { id: string; key: string; created_at: string; revoked: boolean };

export default function Dashboard() {
  const { token, logout } = useAuth();
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKey[]>([]);

  useEffect(() => {
    if (!token) return router.replace("/login");
    fetchKeys();
  }, [token]);

  async function fetchKeys() {
    const res = await authApi.get<ApiKey[]>("/auth/apikeys");
    setKeys(res.data);
  }

  async function createKey() {
    await authApi.post("/auth/apikey");
    fetchKeys();
  }

  return (
    <div style={{ maxWidth: 600, margin: "auto", padding: 20 }}>
      <h1>Your API Keys</h1>
      <button onClick={createKey}>Generate New Key</button>
      <button onClick={logout} style={{ marginLeft: 12 }}>Log Out</button>

      <ul>
        {keys.map(k => (
          <li key={k.id} style={{ marginTop: 8 }}>
            <code>{k.key}</code> &nbsp; <small>created {new Date(k.created_at).toLocaleString()}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
