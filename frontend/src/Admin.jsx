import { useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "https://heritage-health-hub.onrender.com";

export default function Admin({ onClose }) {
  const [token, setToken] = useState(localStorage.getItem("hh_token") || "");
  const [email, setEmail] = useState("admin@heritage.local");
  const [password, setPassword] = useState("admin123");
  const [status, setStatus] = useState("");

  const [site, setSite] = useState({
    name: "",
    category: "tourist",
    province: "",
    latitude: -17.8292,
    longitude: 31.0522,
    wiki_title: "",
    active: true,
  });

  const isLoggedIn = !!token;

  const login = async () => {
    setStatus("Logging in...");
    try {
      const form = new FormData();
      form.append("username", email);
      form.append("password", password);

      const res = await axios.post(`${API}/api/auth/login`, form);
      localStorage.setItem("hh_token", res.data.access_token);
      setToken(res.data.access_token);
      setStatus("Login successful ✅");
    } catch {
      setStatus("Login failed ❌ (check email/password)");
    }
  };

  const logout = () => {
    localStorage.removeItem("hh_token");
    setToken("");
    setStatus("Logged out");
  };

  const createSite = async () => {
    setStatus("Creating site...");
    try {
      await axios.post(`${API}/api/admin/sites`, site, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStatus("Site created ✅ Close and click Refresh or reopen Admin.");
      setSite({
        name: "",
        category: "tourist",
        province: "",
        latitude: -17.8292,
        longitude: 31.0522,
        wiki_title: "",
        active: true,
      });
    } catch (e) {
      setStatus("Failed ❌ (check you are logged in + all fields filled)");
      console.log(e);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 12,
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          background: "white",
          borderRadius: 16,
          border: "1px solid #eee",
          padding: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Admin Panel</div>
            <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
              Login, then add new heritage/tourist sites.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ border: "1px solid #ddd", background: "#fafafa", padding: "10px 12px", borderRadius: 12, cursor: "pointer" }}
          >
            Close
          </button>
        </div>

        <hr style={{ margin: "14px 0" }} />

        {!isLoggedIn ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 700 }}>Login</div>

            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />

            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              type="password"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />

            <button
              onClick={login}
              style={{ border: "none", background: "#111", color: "white", padding: 10, borderRadius: 10, cursor: "pointer" }}
            >
              Login
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700 }}>Create Site</div>
              <button
                onClick={logout}
                style={{ border: "1px solid #ddd", background: "#fafafa", padding: "8px 10px", borderRadius: 10, cursor: "pointer" }}
              >
                Logout
              </button>
            </div>

            <input
              value={site.name}
              onChange={(e) => setSite({ ...site, name: e.target.value })}
              placeholder="Site name"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />

            <select
              value={site.category}
              onChange={(e) => setSite({ ...site, category: e.target.value })}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            >
              <option value="heritage">Heritage</option>
              <option value="tourist">Tourist</option>
            </select>

            <input
              value={site.province}
              onChange={(e) => setSite({ ...site, province: e.target.value })}
              placeholder="Province (e.g., Mashonaland Central)"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <input
                type="number"
                value={site.latitude}
                onChange={(e) => setSite({ ...site, latitude: Number(e.target.value) })}
                placeholder="Latitude"
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              />
              <input
                type="number"
                value={site.longitude}
                onChange={(e) => setSite({ ...site, longitude: Number(e.target.value) })}
                placeholder="Longitude"
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              />
            </div>

            <input
              value={site.wiki_title}
              onChange={(e) => setSite({ ...site, wiki_title: e.target.value })}
              placeholder="Wikipedia title (optional)"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />

            <button
              onClick={createSite}
              style={{ border: "none", background: "#111", color: "white", padding: 10, borderRadius: 10, cursor: "pointer" }}
            >
              Create Site
            </button>
          </div>
        )}

        {status ? (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 12, border: "1px solid #eee", background: "#fafafa", fontSize: 13 }}>
            {status}
          </div>
        ) : null}
      </div>
    </div>
  );
}