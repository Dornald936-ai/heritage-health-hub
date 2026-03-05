import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import Admin from "./Admin";

// ✅ Fix Leaflet marker icons for Vite/React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ✅ Backend URL (local). Later for deployment you can switch to env var.
const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// ------------------ Helpers ------------------
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function AlertBox({ kind = "info", title, children }) {
  const styles = {
    info: { border: "1px solid #d7e7ff", bg: "#f3f8ff", color: "#0b3b8c" },
    warn: { border: "1px solid #ffe3b3", bg: "#fff8ea", color: "#7a4b00" },
    danger: { border: "1px solid #f3c2c2", bg: "#fff5f5", color: "#7a0000" },
    success: { border: "1px solid #cfe9d6", bg: "#f3fff7", color: "#1c6b33" },
  }[kind];

  return (
    <div
      style={{
        border: styles.border,
        background: styles.bg,
        color: styles.color,
        padding: 12,
        borderRadius: 14,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, lineHeight: 1.4 }}>{children}</div>
    </div>
  );
}

function buildSmartAlerts(site, weatherObj, facilitiesCount) {
  const alerts = [];
  const current = weatherObj?.current || null;

  // Always show baseline safety reminders
  alerts.push({
    kind: "info",
    title: "Visitor safety basics",
    msg: `Carry clean drinking water, keep a charged phone, and share your route with someone if hiking. For ${site?.name || "this site"}, wear comfortable walking shoes.`,
  });

  // Time-of-day guidance
  const hour = new Date().getHours();
  if (hour <= 8) {
    alerts.push({
      kind: "info",
      title: "Morning tip",
      msg: "Mornings can feel cooler. Consider a light jacket and start walks early to avoid midday heat.",
    });
  } else if (hour >= 17) {
    alerts.push({
      kind: "warn",
      title: "Evening tip",
      msg: "It may get cooler and darker quickly. Carry a light jacket and avoid isolated paths after sunset.",
    });
  }

  if (current && typeof current.temperature_2m === "number") {
    const t = current.temperature_2m;

    if (t >= 32) {
      alerts.push({
        kind: "danger",
        title: "Heat stress risk",
        msg: `It’s hot (~${t}°C). Drink water often, take shade breaks, and use sunscreen + hat.`,
      });
    } else if (t >= 28) {
      alerts.push({
        kind: "warn",
        title: "Hot conditions",
        msg: `Warm weather (~${t}°C). Light clothing recommended. Keep hydrated.`,
      });
    } else if (t <= 10) {
      alerts.push({
        kind: "warn",
        title: "Cold conditions",
        msg: `Cool weather (~${t}°C). Wear warm layers; keep dry if hiking.`,
      });
    }
  }

  if (current && typeof current.precipitation === "number" && current.precipitation > 0) {
    alerts.push({
      kind: "warn",
      title: "Rain / slippery surfaces",
      msg: `Rain detected. Watch out for slippery rocks/paths. Carry a rain jacket.`,
    });
  }

  if (current && typeof current.wind_speed_10m === "number" && current.wind_speed_10m >= 25) {
    alerts.push({
      kind: "warn",
      title: "Strong winds",
      msg: `Wind is high (~${current.wind_speed_10m} km/h). Secure hats/caps and be careful near cliffs/trees.`,
    });
  }

  // Nearby health access
  if (typeof facilitiesCount === "number") {
    if (facilitiesCount === 0) {
      alerts.push({
        kind: "danger",
        title: "Limited health access nearby",
        msg: "No nearby clinics/hospitals were found within 10km. Travel with caution and keep emergency contacts ready.",
      });
    } else if (facilitiesCount <= 2) {
      alerts.push({
        kind: "warn",
        title: "Few facilities nearby",
        msg: `Only ${facilitiesCount} facilities found nearby. Keep basic first-aid supplies.`,
      });
    } else {
      alerts.push({
        kind: "success",
        title: "Health access available",
        msg: `${facilitiesCount} nearby facilities found. You can route to them if needed.`,
      });
    }
  }

  // Region-based general alert (simple heuristic)
  const province = (site?.province || "").toLowerCase();
  if (province.includes("manicaland") || province.includes("masvingo") || province.includes("matabeleland") || province.includes("mashonaland")) {
    alerts.push({
      kind: "info",
      title: "Health note (general)",
      msg: "If you’re sensitive to insects, carry repellent. If you have allergies/asthma, keep medication with you.",
    });
  }

  return alerts;
}

// ------------------ App ------------------
export default function App() {
  const [sites, setSites] = useState([]);
  const [loadingSites, setLoadingSites] = useState(true);
  const [err, setErr] = useState("");

  const [selected, setSelected] = useState(null);

  const [wiki, setWiki] = useState(null);
  const [weather, setWeather] = useState(null);
  const [nearby, setNearby] = useState(null);

  const [loadingDetails, setLoadingDetails] = useState(false);

  const [showAdmin, setShowAdmin] = useState(false);

  const [userLocation, setUserLocation] = useState(null);
  const [gpsStatus, setGpsStatus] = useState("");

  const facilities = nearby?.results || [];

  const loadSites = async () => {
    try {
      setErr("");
      setLoadingSites(true);
      const res = await axios.get(`${API}/api/sites`);
      setSites(res.data);
    } catch {
      setErr("Failed to load sites. Make sure backend is running (http://127.0.0.1:8000/docs).");
    } finally {
      setLoadingSites(false);
    }
  };

  useEffect(() => {
    loadSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openGoogleRoute = (originLat, originLon, destLat, destLon) => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
      `${originLat},${originLon}`
    )}&destination=${encodeURIComponent(`${destLat},${destLon}`)}&travelmode=driving`;
    window.open(url, "_blank");
  };

  const openSite = async (site) => {
    setSelected(site);
    setWiki(null);
    setWeather(null);
    setNearby(null);
    setLoadingDetails(true);

    try {
      const tasks = [];

      // Wikipedia overview
      if (site.wiki_title) {
        tasks.push(axios.get(`${API}/api/wiki`, { params: { title: site.wiki_title } }));
      } else {
        tasks.push(Promise.resolve({ data: null }));
      }

      // Weather + nearby health facilities
      tasks.push(axios.get(`${API}/api/weather`, { params: { lat: site.latitude, lon: site.longitude } }));
      tasks.push(axios.get(`${API}/api/nearby-health`, { params: { lat: site.latitude, lon: site.longitude, radius_m: 10000 } }));

      const [w1, w2, w3] = await Promise.all(tasks);

      setWiki(w1.data);
      setWeather(w2.data);
      setNearby(w3.data);
    } catch (e) {
      console.log(e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeDetails = () => {
    setSelected(null);
    setWiki(null);
    setWeather(null);
    setNearby(null);
  };

  const detectLocation = () => {
    setGpsStatus("");
    if (!navigator.geolocation) {
      setGpsStatus("Geolocation not supported by your browser.");
      return;
    }

    setGpsStatus("Detecting your location...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setUserLocation({ lat, lon });
        setGpsStatus(`Location detected: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);

        // Auto-open nearest site for a nice demo
        if (sites?.length) {
          let best = null;
          let bestKm = Infinity;
          for (const s of sites) {
            const km = haversineKm(lat, lon, s.latitude, s.longitude);
            if (km < bestKm) {
              bestKm = km;
              best = s;
            }
          }
          if (best) openSite(best);
        }
      },
      (err) => {
        setGpsStatus(`Unable to detect location: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const siteCount = useMemo(() => sites.length, [sites]);

  const smartAlerts = useMemo(() => {
    if (!selected) return [];
    return buildSmartAlerts(selected, weather, facilities?.length);
  }, [selected, weather, facilities?.length]);

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 20, maxWidth: 1200, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>Heritage Health Hub</h1>
          <p style={{ marginTop: 6, color: "#555" }}>
            Health insights for tourists and visitors at heritage & tourist sites in Zimbabwe
          </p>
          <div style={{ fontSize: 12, color: "#777" }}>{siteCount} sites loaded</div>
          {gpsStatus ? <div style={{ marginTop: 6, fontSize: 12, color: "#444" }}>{gpsStatus}</div> : null}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            onClick={detectLocation}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #2c7be5",
              background: "#2c7be5",
              color: "white",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Detect My Location
          </button>

          {userLocation ? (
            <button
              onClick={() => openGoogleRoute(userLocation.lat, userLocation.lon, userLocation.lat, userLocation.lon)}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#fafafa",
                color: "#111",
                cursor: "pointer",
              }}
              title="Opens Google Maps centered on your location"
            >
              Open My GPS in Maps
            </button>
          ) : null}

          <button
            onClick={() => setShowAdmin(true)}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "white",
              cursor: "pointer",
            }}
          >
            Admin
          </button>

          <button
            onClick={loadSites}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fafafa",
              color: "#111",
              cursor: "pointer",
            }}
          >
            Refresh
          </button>

          <a
            href={`${API}/docs`}
            target="_blank"
            rel="noreferrer"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              textDecoration: "none",
              color: "#111",
              background: "#fafafa",
            }}
          >
            API Docs
          </a>
        </div>
      </header>

      <hr style={{ margin: "18px 0" }} />

      {loadingSites && <p>Loading sites...</p>}

      {err && (
        <div style={{ padding: 12, border: "1px solid #f3c2c2", background: "#fff5f5", borderRadius: 10, color: "#a40000" }}>
          {err}
          <div style={{ marginTop: 8, fontSize: 13, color: "#7a0000" }}>
            Make sure backend is running from <b>backend</b> folder: <code>python -m uvicorn main:app --port 8000</code>
          </div>
        </div>
      )}

      {!loadingSites && !err && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          {sites.map((s) => (
            <div key={s.id} style={{ border: "1px solid #e6e6e6", borderRadius: 14, padding: 14, background: "white" }}>
              <div style={{ fontSize: 12, color: "#666" }}>
                {s.category?.toUpperCase()} • {s.province}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>{s.name}</div>

              <div style={{ marginTop: 10, fontSize: 13, color: "#444" }}>
                {s.latitude}, {s.longitude}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <button
                  onClick={() => openSite(s)}
                  style={{
                    border: "none",
                    background: "#111",
                    color: "white",
                    padding: "10px 12px",
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                >
                  View Details
                </button>

                <button
                  onClick={() => openGoogleRoute(s.latitude, s.longitude, s.latitude, s.longitude)}
                  style={{
                    border: "1px solid #ddd",
                    background: "#fafafa",
                    color: "#111",
                    padding: "10px 12px",
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                  title="Opens Google Maps for the site"
                >
                  Open in Google Maps
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DETAILS DRAWER */}
      {selected && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-end",
            padding: 12,
            zIndex: 9998,
          }}
          onClick={closeDetails}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 1100,
              background: "white",
              borderRadius: 18,
              border: "1px solid #eee",
              padding: 16,
              maxHeight: "85vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
              <div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  {selected.category?.toUpperCase()} • {selected.province}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{selected.name}</div>
                <div style={{ marginTop: 6, color: "#555", fontSize: 13 }}>
                  Coordinates: {selected.latitude}, {selected.longitude}
                </div>
              </div>

              <button
                onClick={closeDetails}
                style={{
                  border: "1px solid #ddd",
                  background: "#fafafa",
                  padding: "10px 12px",
                  borderRadius: 12,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>

            <hr style={{ margin: "14px 0" }} />

            {loadingDetails && <div style={{ color: "#555" }}>Loading details…</div>}

            {/* SMART HEALTH ALERTS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              {smartAlerts.map((a, idx) => (
                <AlertBox key={idx} kind={a.kind} title={a.title}>
                  {a.msg}
                </AlertBox>
              ))}
            </div>

            {/* MAP */}
            <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14, marginTop: 14 }}>
              <div style={{ fontWeight: 800 }}>Map view (Site + nearby clinics + your GPS)</div>

              <div style={{ marginTop: 10 }}>
                <MapContainer
                  center={[selected.latitude, selected.longitude]}
                  zoom={10}
                  style={{ height: 380, width: "100%", borderRadius: 12 }}
                >
                  <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                  <Marker position={[selected.latitude, selected.longitude]}>
                    <Popup>{selected.name}</Popup>
                  </Marker>

                  {userLocation ? (
                    <Marker position={[userLocation.lat, userLocation.lon]}>
                      <Popup>You are here</Popup>
                    </Marker>
                  ) : null}

                  {facilities.slice(0, 25).map((f, i) => (
                    <Marker key={i} position={[f.lat, f.lon]}>
                      <Popup>
                        <div style={{ fontWeight: 800 }}>{f.name}</div>
                        <div style={{ fontSize: 12, color: "#666" }}>{f.type}</div>
                        {f.address ? <div style={{ fontSize: 12, marginTop: 4 }}>{f.address}</div> : null}
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                {userLocation ? (
                  <button
                    onClick={() => openGoogleRoute(userLocation.lat, userLocation.lon, selected.latitude, selected.longitude)}
                    style={{
                      border: "none",
                      background: "#111",
                      color: "white",
                      padding: "10px 12px",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    Route from my location → site
                  </button>
                ) : (
                  <button
                    onClick={detectLocation}
                    style={{
                      border: "none",
                      background: "#2c7be5",
                      color: "white",
                      padding: "10px 12px",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    Enable GPS to route
                  </button>
                )}
              </div>
            </div>

            {/* WIKI */}
            <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14, marginTop: 14 }}>
              <div style={{ fontWeight: 800 }}>Site overview (Wikipedia)</div>
              {wiki?.thumbnail ? (
                <img alt="thumbnail" src={wiki.thumbnail} style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 12, marginTop: 10 }} />
              ) : null}
              <div style={{ marginTop: 10, color: "#444", fontSize: 14 }}>
                {wiki?.extract ? wiki.extract : "No summary found (still OK for demo)."}
              </div>

              {wiki?.content_urls?.desktop?.page ? (
                <a href={wiki.content_urls.desktop.page} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 10, fontSize: 13 }}>
                  Read more →
                </a>
              ) : null}
            </div>

            {/* WEATHER + NEARBY */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginTop: 14 }}>
              <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
                <div style={{ fontWeight: 800 }}>Current weather + Wear suggestion</div>
                <div style={{ marginTop: 8, color: "#444", fontSize: 14 }}>
                  {weather?.current ? (
                    <>
                      <div>
                        Temperature: <b>{weather.current.temperature_2m}°C</b>
                      </div>
                      <div>
                        Feels like: <b>{weather.current.apparent_temperature}°C</b>
                      </div>
                      <div>
                        Wind: <b>{weather.current.wind_speed_10m} km/h</b>
                      </div>
                      <div>
                        Rain: <b>{weather.current.precipitation} mm</b>
                      </div>
                      <div style={{ marginTop: 10, padding: 10, background: "#fafafa", border: "1px solid #eee", borderRadius: 12 }}>
                        <b>Wear:</b> {weather.wear_suggestion}
                      </div>
                    </>
                  ) : (
                    "Weather not available yet."
                  )}
                </div>
              </div>

              <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
                <div style={{ fontWeight: 800 }}>Nearby clinics & hospitals (10km)</div>
                <div style={{ marginTop: 8, color: "#444", fontSize: 14 }}>
                  {facilities.length ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {facilities.slice(0, 8).map((h, idx) => (
                        <div key={idx} style={{ border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
                          <div style={{ fontWeight: 800 }}>{h.name}</div>
                          <div style={{ fontSize: 12, color: "#666" }}>{h.type}</div>
                          {h.address ? <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>{h.address}</div> : null}

                          {userLocation ? (
                            <button
                              onClick={() => openGoogleRoute(userLocation.lat, userLocation.lon, h.lat, h.lon)}
                              style={{
                                marginTop: 8,
                                width: "100%",
                                border: "none",
                                background: "#111",
                                color: "white",
                                padding: "9px 10px",
                                borderRadius: 10,
                                cursor: "pointer",
                                fontSize: 13,
                              }}
                            >
                              Route from my location → this facility
                            </button>
                          ) : (
                            <button
                              onClick={detectLocation}
                              style={{
                                marginTop: 8,
                                width: "100%",
                                border: "1px solid #ddd",
                                background: "#fafafa",
                                color: "#111",
                                padding: "9px 10px",
                                borderRadius: 10,
                                cursor: "pointer",
                                fontSize: 13,
                              }}
                            >
                              Enable GPS to route
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    "No nearby facilities returned yet (still OK for demo)."
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14, color: "#777", fontSize: 12 }}>
              Commercialization-ready demo: GPS, smart alerts, maps, nearby health facilities, admin management.
            </div>
          </div>
        </div>
      )}

      {/* ADMIN MODAL */}
      {showAdmin && (
        <Admin
          onClose={() => {
            setShowAdmin(false);
            loadSites();
          }}
        />
      )}
    </div>
  );
}