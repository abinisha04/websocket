"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function UserLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.message);
      return;
    }

    console.log("Logged in user:", data.user);

    localStorage.setItem("user", JSON.stringify(data.user));

    router.push(`/chat/${data.user.userId}`);
  };

  return (
    <div className="w-[350px] mx-auto mt-20 border rounded-lg p-5">
      <h1 className="text-2xl font-semibold mb-5">User Login</h1>

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

        <button type="submit" className=" rounded p-2 bg-blue-400 hover:bg-blue-600">
          Login
        </button>

        <p className="text-sm text-center mt-3">
          Don't have an account?{" "}
          <Link href="/signup" className="text-blue-600 hover:underline">
            Signup
          </Link>
        </p>
      </form>
    </div>
  );
}
