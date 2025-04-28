"use client";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import authApi from "../utils/authApi";

type Form = { email: string; password: string; };

export default function Signup() {
  const { register, handleSubmit } = useForm<Form>();
  const router = useRouter();

  const onSubmit = async (data: Form) => {
    try {
      const res = await authApi.post("/auth/signup", data);
      localStorage.setItem("token", res.data.access_token);
      router.push("/dashboard");
    } catch {
      alert("Signup failed");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ maxWidth: 320, margin: "auto", paddingTop: 80 }}>
      <h2>Sign Up</h2>
      <input {...register("email")} type="email" placeholder="Email" required style={{ width: "100%" }} />
      <input {...register("password")} type="password" placeholder="Password" required style={{ width: "100%", marginTop: 8 }} />
      <button type="submit" style={{ width: "100%", marginTop: 12 }}>Create Account</button>
    </form>
  );
}
