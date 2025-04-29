"use client";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import authApi from "../utils/authApi";

type Form = { email: string; password: string };

export default function Signup() {
  const { register, handleSubmit } = useForm<Form>();
  const router = useRouter();

  const onSubmit = async (data: Form) => {
    try {
      // now posts to <AUTH_URL>/auth/signup
      const res = await authApi.post("/signup", data);
      localStorage.setItem("token", res.data.access_token);
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Signup error:", err);
      const msg = err.response?.data?.detail || err.message;
      alert("Signup failed: " + msg);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      style={{ maxWidth: 320, margin: "auto", paddingTop: 80 }}
    >
      <h2>Sign Up</h2>
      <input
        {...register("email")}
        type="email"
        placeholder="Email"
        required
        style={{ width: "100%" }}
      />
      <input
        {...register("password")}
        type="password"
        placeholder="Password"
        required
        style={{ width: "100%", marginTop: 8 }}
      />
      <button
        type="submit"
        style={{ width: "100%", marginTop: 12 }}
      >
        Create Account
      </button>
    </form>
  );
}
