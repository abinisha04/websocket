"use client";

import { useState } from "react";
import Link from "next/link";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.message);
      return;
    }

    setMessage(data.message);

    setName("");
    setEmail("");
    setPassword("");
  };

  return (
    <div className="w-[350px] mx-auto mt-20 border rounded-lg p-5">
      <h1 className="text-2xl font-semibold mb-5">User Signup</h1>

      <form onSubmit={handleSignup} className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded p-2"
        />

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

        {message && <p className="text-green-600 text-sm">{message}</p>}

        <button type="submit" className="border rounded p-2">
          Signup
        </button>

        <p className="text-sm text-center mt-3">
          Already have an account?{" "}
          <Link href="/" className="text-blue-600 hover:underline">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}
