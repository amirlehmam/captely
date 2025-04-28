// frontend/captely-web/pages/dashboard.tsx
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function Dashboard() {
  const router = useRouter();

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div>
      <h1>Welcome to Captely</h1>
      <p>This will be your dashboard where you see your API-keys, imports, etc.</p>
    </div>
  );
}
