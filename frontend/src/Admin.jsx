import { useEffect, useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const emptySite = {
  name: "",
  category: "tourist",
  province: "",
  latitude: "",
  longitude: "",
  wiki_title: "",
  image_url: "",
  summary: "",
  health_tip: "",
  risk_level: "Moderate",
  recommended_items: "",
  emergency_note: "",
  active: true,
};

export default function Admin({ onClose }) {
  const [email, setEmail] = useState("admin@heritage.local");
  const [password, setPassword] = useState("admin123");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("");

  const [sites, setSites] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [site, setSite] = useState(emptySite);

  const authHeaders = token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};

  const loadSites = async () => {
    try {
      const res = await axios.get(`${API}/api/sites`);
      setSites(res.data);
    } catch (e) {
      console.log(e);
    }
  };

  useEffect(() => {
    loadSites();
  }, []);

  const login = async () => {
    try {
      setStatus("Logging in...");
      const form = new FormData();
      form.append("username", email);
      form.append("password", password);

      const res = await axios.post(`${API}/api/auth/login`, form);
      setToken(res.data.access_token);
      setStatus("Admin login successful.");
    } catch (e) {
      console.log(e);
      setStatus("Login failed.");
    }
  };

  const resetForm = () => {
    setSite(emptySite);
    setEditingId(null);
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setSite({
      name: row.name || "",
      category: row.category || "tourist",
      province: row.province || "",
      latitude: row.latitude ?? "",
      longitude: row.longitude ?? "",
      wiki_title: row.wiki_title || "",
      image_url: row.image_url || "",
      summary: row.summary || "",
      health_tip: row.health_tip || "",
      risk_level: row.risk_level || "Moderate",
      recommended_items: row.recommended_items || "",
      emergency_note: row.emergency_note || "",
      active: row.active ?? true,
    });
    setStatus(`Editing: ${row.name}`);
  };

  const saveSite = async () => {
    try {
      setStatus(editingId ? "Updating site..." : "Creating site...");

      const payload = {
        ...site,
        latitude: Number(site.latitude),
        longitude: Number(site.longitude),
      };

      if (editingId) {
        await axios.put(`${API}/api/admin/sites/${editingId}`, payload, {
          headers: authHeaders,
        });
        setStatus("Site updated successfully.");
      } else {
        await axios.post(`${API}/api/admin/sites`, payload, {
          headers: authHeaders,
        });
        setStatus("Site created successfully.");
      }

      resetForm();
      await loadSites();
    } catch (e) {
      console.log(e);
      setStatus("Failed to save site.");
    }
  };

  const deleteSite = async (id) => {
    try {
      setStatus("Deleting site...");
      await axios.delete(`${API}/api/admin/sites/${id}`, {
        headers: authHeaders,
      });
      setStatus("Site removed.");
      if (editingId === id) resetForm();
      await loadSites();
    } catch (e) {
      console.log(e);
      setStatus("Failed to delete site.");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
        padding: 12,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1200,
          background: "white",
          borderRadius: 18,
          padding: 20,
          maxHeight: "92vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "start",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Version 2 Admin Panel</h2>
            <div style={{ marginTop: 6, color: "#6b7280", fontSize: 14 }}>
              Manage site summaries, images, health tips, risk levels, and emergency notes.
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              border: "1px solid #d1d5db",
              background: "white",
              padding: "10px 12px",
              borderRadius: 10,
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Close
          </button>
        </div>

        {!token ? (
          <div
            style={{
              marginTop: 20,
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: 18,
              background: "#fafafa",
              maxWidth: 500,
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 12 }}>Admin Login</div>

            <div style={{ display: "grid", gap: 10 }}>
              <input
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                }}
              />

              <input
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                }}
              />

              <button
                onClick={login}
                style={{
                  border: "none",
                  background: "#111827",
                  color: "white",
                  padding: 12,
                  borderRadius: 10,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Login
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              marginTop: 20,
              display: "grid",
              gridTemplateColumns: "1.05fr 1fr",
              gap: 18,
            }}
          >
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 18,
                background: "white",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontWeight: 800 }}>
                  {editingId ? "Edit Site" : "Create New Site"}
                </div>

                <button
                  onClick={resetForm}
                  style={{
                    border: "1px solid #d1d5db",
                    background: "white",
                    padding: "8px 10px",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Reset Form
                </button>
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "grid",
                  gap: 10,
                }}
              >
                <input
                  placeholder="Site name"
                  value={site.name}
                  onChange={(e) => setSite({ ...site, name: e.target.value })}
                  style={{ padding: 12, borderRadius: 10, border: "1px solid #d1d5db" }}
                />

                <select
                  value={site.category}
                  onChange={(e) => setSite({ ...site, category: e.target.value })}
                  style={{ padding: 12, borderRadius: 10, border: "1px solid #d1d5db" }}
                >
                  <option value="heritage">Heritage</option>
                  <option value="tourist">Tourist</option>
                </select>

                <input
                  placeholder="Province"
                  value={site.province}
                  onChange={(e) => setSite({ ...site, province: e.target.value })}
                  style={{ padding: 12, borderRadius: 10, border: "1px solid #d1d5db" }}
                />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <input
                    placeholder="Latitude"
                    value={site.latitude}
                    onChange={(e) => setSite({ ...site, latitude: e.target.value })}
                    style={{ padding: 12, borderRadius: 10, border: "1px solid #d1d5db" }}
                  />

                  <input
                    placeholder="Longitude"
                    value={site.longitude}
                    onChange={(e) => setSite({ ...site, longitude: e.target.value })}
                    style={{ padding: 12, borderRadius: 10, border: "1px solid #d1d5db" }}
                  />
                </div>

                <input
                  placeholder="Wikipedia title"
                  value={site.wiki_title}
                  onChange={(e) => setSite({ ...site, wiki_title: e.target.value })}
                  style={{ padding: 12, borderRadius: 10, border: "1px solid #d1d5db" }}
                />

                <input
                  placeholder="Image URL"
                  value={site.image_url}
                  onChange={(e) => setSite({ ...site, image_url: e.target.value })}
                  style={{ padding: 12, borderRadius: 10, border: "1px solid #d1d5db" }}
                />

                <textarea
                  placeholder="Site summary"
                  value={site.summary}
                  onChange={(e) => setSite({ ...site, summary: e.target.value })}
                  rows={4}
                  style={{ padding: 12, borderRadius: 10, border: "1px solid #d1d5db" }}
                />

                <textarea
                  placeholder="Health tip"
                  value={site.health_tip}
                  onChange={(e) => setSite({ ...site, health_tip: e.target.value })}
                  rows={4}
                  style={{ padding: 12, borderRadius: 10, border: "1px solid #d1d5db" }}
                />

                <select
                  value={site.risk_level}
                  onChange={(e) => setSite({ ...site, risk_level: e.target.value })}
                  style={{ padding: 12, borderRadius: 10, border: "1px solid #d1d5db" }}
                >
                  <option value="Low">Low</option>
                  <option value="Moderate">Moderate</option>
                  <option value="High">High</option>
                </select>

                <textarea
                  placeholder="Recommended items"
                  value={site.recommended_items}
                  onChange={(e) =>
                    setSite({ ...site, recommended_items: e.target.value })
                  }
                  rows={3}
                  style={{ padding: 12, borderRadius: 10, border: "1px solid #d1d5db" }}
                />

                <textarea
                  placeholder="Emergency note"
                  value={site.emergency_note}
                  onChange={(e) => setSite({ ...site, emergency_note: e.target.value })}
                  rows={3}
                  style={{ padding: 12, borderRadius: 10, border: "1px solid #d1d5db" }}
                />

                <button
                  onClick={saveSite}
                  style={{
                    border: "none",
                    background: "#111827",
                    color: "white",
                    padding: 12,
                    borderRadius: 10,
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {editingId ? "Update Site" : "Create Site"}
                </button>
              </div>
            </div>

            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 18,
                background: "white",
              }}
            >
              <div style={{ fontWeight: 800 }}>Existing Sites</div>

              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {sites.map((row) => (
                  <div
                    key={row.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: 12,
                      background: "#fafafa",
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>{row.name}</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
                      {row.category} • {row.province} • {row.risk_level}
                    </div>

                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => startEdit(row)}
                        style={{
                          border: "1px solid #d1d5db",
                          background: "white",
                          padding: "8px 10px",
                          borderRadius: 10,
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => deleteSite(row.id)}
                        style={{
                          border: "none",
                          background: "#b91c1c",
                          color: "white",
                          padding: "8px 10px",
                          borderRadius: 10,
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {status ? (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 12,
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
              color: "#374151",
              fontSize: 14,
            }}
          >
            {status}
          </div>
        ) : null}
      </div>
    </div>
  );
}