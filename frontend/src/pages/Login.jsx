import { useState } from "react";
import { API } from "../api";

export default function Login({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const call = async (path, body) => {
    const res = await fetch(`${API}/api/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Something went wrong");
    return data;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "register") {
        await call("register", { name, email, password });
      }
      const user = await call("login", { email, password });
      localStorage.setItem("signtalk_user", JSON.stringify(user));
      onLogin(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const input = {
    width: "100%", padding: "12px 14px", marginBottom: 12,
    border: "1px solid #d9d9e8", borderRadius: 10, fontSize: 15, boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5fb" }}>
      <form onSubmit={submit} style={{ width: 360, background: "#fff", padding: 32, borderRadius: 18, boxShadow: "0 10px 40px rgba(80,70,230,.15)" }}>
        <h2 style={{ margin: "0 0 4px" }}>Sign Talk</h2>
        <p style={{ margin: "0 0 20px", color: "#777" }}>
          {mode === "login" ? "Log in to continue" : "Create your student account"}
        </p>

        {mode === "register" && (
          <input style={input} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
        )}
        <input style={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input style={input} type="password" placeholder="Password (min 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} required />

        {error && <p style={{ color: "#d33", margin: "0 0 12px" }}>{error}</p>}

        <button type="submit" disabled={busy}
          style={{ width: "100%", padding: 13, border: 0, borderRadius: 10, background: "#5b4af0", color: "#fff", fontSize: 16, cursor: "pointer" }}>
          {busy ? "Please wait..." : mode === "login" ? "Log in" : "Register"}
        </button>

        <p style={{ textAlign: "center", marginTop: 16, color: "#666" }}>
          {mode === "login" ? "New student? " : "Already have an account? "}
          <a href="#" onClick={(e) => { e.preventDefault(); setError(""); setMode(mode === "login" ? "register" : "login"); }}>
            {mode === "login" ? "Register" : "Log in"}
          </a>
        </p>
      </form>
    </div>
  );
}