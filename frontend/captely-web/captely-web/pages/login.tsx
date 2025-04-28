// frontend/captely-web/pages/login.tsx
import { useForm } from "react-hook-form";
import { useRouter } from "next/router";
import api from "../utils/api";

type FormData = { email: string; password: string };

export default function Login() {
  const { register, handleSubmit } = useForm<FormData>();
  const router = useRouter();

  const onSubmit = async (data: FormData) => {
    try {
      const res = await api.post("/auth/login", data);
      localStorage.setItem("token", res.data.access_token);
      router.push("/dashboard");
    } catch (err) {
      alert("Login failed");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h1>Log In</h1>
      <input {...register("email")} type="email" placeholder="Email" required />
      <input {...register("password")} type="password" placeholder="Password" required />
      <button type="submit">Log In</button>
    </form>
  );
}
