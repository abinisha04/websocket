"use client";

import { useState } from "react";

export default function SetupAdmin() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const createAdmin = async (e) => {
    e.preventDefault();

    const response = await fetch("/api/admin/create", {
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

    setMessage(data.message);

    if (response.ok) {
      setName("");
      setEmail("");
      setPassword("");
    }
  };

  return (
    <div className="w-[350px] mx-auto mt-20 border rounded-lg p-5">
      <h1 className="text-2xl font-semibold mb-5">
        Create Admin
      </h1>

      <form
        onSubmit={createAdmin}
        className="flex flex-col gap-3"
      >
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

        <button
          type="submit"
          className="border rounded p-2"
        >
          Create Admin
        </button>
      </form>

      {message && (
        <p className="mt-3 text-sm">
          {message}
        </p>
      )}
    </div>
  );
}