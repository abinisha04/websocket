"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      console.log("Login started");

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      console.log("Login API status:", response.status);

      const data = await response.json();

      console.log("Login API response:", data);

      if (!response.ok) {
        setError(data.message || "Login failed");
        return;
      }

      console.log("Login successful. Redirecting to /home");

      router.push("/home");
    } catch (error) {
      console.error("Login error:", error);
      setError("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="w-[350px] mx-auto mt-20 border rounded-lg p-5">
      <h1 className="text-2xl font-semibold mb-5">Admin Login</h1>

      <form onSubmit={handleLogin} className="flex flex-col gap-3">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded p-2"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded p-2"
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button type="submit" className="border rounded p-2">
          Login
        </button>
      </form>
    </div>
  );
}
