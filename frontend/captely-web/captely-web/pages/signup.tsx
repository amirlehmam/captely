// frontend/captely-web/pages/signup.tsx
import { useForm } from "react-hook-form";
import { useRouter } from "next/router";
import api from "../utils/api";

type FormData = { email: string; password: string };

export default function Signup() {
  const { register, handleSubmit } = useForm<FormData>();
  const router = useRouter();

  const onSubmit = async (data: FormData) => {
    try {
      const res = await api.post("/auth/signup", data);
      localStorage.setItem("token", res.data.access_token);
      router.push("/dashboard");
    } catch (err) {
      alert("Signup failed");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h1>Sign Up</h1>
      <input {...register("email")} type="email" placeholder="Email" required />
      <input {...register("password")} type="password" placeholder="Password" required />
      <button type="submit">Sign Up</button>
    </form>
  );
}
