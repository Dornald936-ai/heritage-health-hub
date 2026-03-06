import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import Admin from "./Admin";

// Leaflet fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

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

function getRiskStyle(level) {
  const risk = (level || "").toLowerCase();

  if (risk === "high") {
    return {
      bg: "#fff1f2",
      border: "1px solid #fecdd3",
      color: "#be123c",
      label: "High Risk",
    };
  }

  if (risk === "moderate") {
    return {
      bg: "#fffbeb",
      border: "1px solid #fde68a",
      color: "#b45309",
      label: "Moderate Risk",
    };
  }

  return {
    bg: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#15803d",
    label: level || "Low Risk",
  };
}

function AlertCard({ title, text, tone = "info" }) {
  const styles = {
    info: {
      background: "#eff6ff",
      border: "1px solid #bfdbfe",
      color: "#1d4ed8",
    },
    warn: {
      background: "#fffbeb",
      border: "1px solid #fde68a",
      color: "#b45309",
    },
    danger: {
      background: "#fff1f2",
      border: "1px solid #fecdd3",
      color: "#be123c",
    },
    success: {
      background: "#f0fdf4",
      border: "1px solid #bbf7d0",
      color: "#15803d",
    },
  }[tone];

  return (
    <div
      style={{
        ...styles,
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, lineHeight: 1.6 }}>{text}</div>
    </div>
  );
}

function StatCard({ label, value, note }) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        padding: 18,
        boxShadow: "0 10px 24px rgba(15,23,42,0.04)",
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, marginTop: 8, color: "#0f172a" }}>{value}</div>
      <div style={{ fontSize: 13, color: "#4b5563", marginTop: 8, lineHeight: 1.5 }}>{note}</div>
    </div>
  );
}

function FeatureCard({ title, text }) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        padding: 18,
        boxShadow: "0 10px 24px rgba(15,23,42,0.04)",
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 800 }}>{title}</div>
      <div style={{ marginTop: 10, color: "#4b5563", fontSize: 14, lineHeight: 1.65 }}>{text}</div>
    </div>
  );
}

function buildSmartAlerts(site, weatherObj, nearbyCount) {
  const alerts = [];
  const current = weatherObj?.current;

  alerts.push({
    title: "Site-specific health guidance",
    tone: "info",
    text:
      site?.health_tip ||
      "Visitors should stay hydrated, wear suitable walking shoes, and monitor fatigue levels during the visit.",
  });

  if (typeof current?.temperature_2m === "number") {
    if (current.temperature_2m >= 30) {
      alerts.push({
        title: "Heat alert",
        tone: "danger",
        text: `Current temperature is about ${current.temperature_2m}°C. Prioritize hydration, shade, and sunscreen use.`,
      });
    } else if (current.temperature_2m >= 24) {
      alerts.push({
        title: "Warm weather advisory",
        tone: "warn",
        text: `Conditions are warm at about ${current.temperature_2m}°C. Light clothing and frequent water intake are recommended.`,
      });
    } else if (current.temperature_2m <= 10) {
      alerts.push({
        title: "Cold weather advisory",
        tone: "warn",
        text: `Current temperature is about ${current.temperature_2m}°C. Warm layers are recommended.`,
      });
    }
  }

  if (typeof current?.precipitation === "number" && current.precipitation > 0) {
    alerts.push({
      title: "Rain / slippery surfaces",
      tone: "warn",
      text: "Rain is present. Surfaces may be slippery, especially at rocky or elevated viewpoints.",
    });
  }

  if (typeof current?.wind_speed_10m === "number" && current.wind_speed_10m >= 25) {
    alerts.push({
      title: "Wind advisory",
      tone: "warn",
      text: `Wind speed is around ${current.wind_speed_10m} km/h. A jacket or windbreaker is advisable.`,
    });
  }

  if (typeof nearbyCount === "number") {
    if (nearbyCount === 0) {
      alerts.push({
        title: "Limited nearby health support",
        tone: "danger",
        text: "No nearby clinics, hospitals, or pharmacies were found within the selected radius.",
      });
    } else {
      alerts.push({
        title: "Nearby support available",
        tone: "success",
        text: `${nearbyCount} health support locations were identified nearby.`,
      });
    }
  }

  if (site?.emergency_note) {
    alerts.push({
      title: "Emergency note",
      tone: "info",
      text: site.emergency_note,
    });
  }

  return alerts;
}

export default function App() {
  const [sites, setSites] = useState([]);
  const [loadingSites, setLoadingSites] = useState(true);
  const [err, setErr] = useState("");
  const [query, setQuery] = useState("");

  const [selected, setSelected] = useState(null);
  const [wiki, setWiki] = useState(null);
  const [weather, setWeather] = useState(null);
  const [nearby, setNearby] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [showAdmin, setShowAdmin] = useState(false);

  const [userLocation, setUserLocation] = useState(null);
  const [gpsStatus, setGpsStatus] = useState("");

  const loadSites = async () => {
    try {
      setErr("");
      setLoadingSites(true);
      const res = await axios.get(`${API}/api/sites`);
      setSites(res.data);
    } catch (e) {
      setErr("Failed to load sites. Make sure the backend is running.");
      console.log(e);
    } finally {
      setLoadingSites(false);
    }
  };

  useEffect(() => {
    loadSites();
  }, []);

  const filteredSites = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sites;

    return sites.filter((s) =>
      `${s.name} ${s.province} ${s.category} ${s.summary} ${s.health_tip}`
        .toLowerCase()
        .includes(q)
    );
  }, [sites, query]);

  const heritageCount = useMemo(
    () => sites.filter((s) => (s.category || "").toLowerCase() === "heritage").length,
    [sites]
  );

  const touristCount = useMemo(
    () => sites.filter((s) => (s.category || "").toLowerCase() === "tourist").length,
    [sites]
  );

  const highRiskCount = useMemo(
    () => sites.filter((s) => (s.risk_level || "").toLowerCase() === "high").length,
    [sites]
  );

  const provinceCount = useMemo(() => {
    return new Set(sites.map((s) => s.province).filter(Boolean)).size;
  }, [sites]);

  const openSite = async (site) => {
    setSelected(site);
    setWiki(null);
    setWeather(null);
    setNearby(null);
    setLoadingDetails(true);

    try {
      const tasks = [];

      if (site.wiki_title) {
        tasks.push(axios.get(`${API}/api/wiki`, { params: { title: site.wiki_title } }));
      } else {
        tasks.push(Promise.resolve({ data: null }));
      }

      tasks.push(
        axios.get(`${API}/api/weather`, {
          params: { lat: site.latitude, lon: site.longitude },
        })
      );

      tasks.push(
        axios.get(`${API}/api/nearby-health`, {
          params: { lat: site.latitude, lon: site.longitude, radius_m: 12000 },
        })
      );

      const [wikiRes, weatherRes, nearbyRes] = await Promise.all(tasks);

      setWiki(wikiRes.data);
      setWeather(weatherRes.data);
      setNearby(nearbyRes.data);
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
      setGpsStatus("Geolocation is not supported by this browser.");
      return;
    }

    setGpsStatus("Detecting your location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setUserLocation({ lat, lon });
        setGpsStatus(`Location detected: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);

        if (sites.length) {
          let nearest = null;
          let bestKm = Infinity;

          for (const s of sites) {
            const km = haversineKm(lat, lon, s.latitude, s.longitude);
            if (km < bestKm) {
              bestKm = km;
              nearest = s;
            }
          }

          if (nearest) openSite(nearest);
        }
      },
      (error) => {
        setGpsStatus(`Unable to detect location: ${error.message}`);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const openGoogleRoute = (originLat, originLon, destLat, destLon) => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
      `${originLat},${originLon}`
    )}&destination=${encodeURIComponent(`${destLat},${destLon}`)}&travelmode=driving`;
    window.open(url, "_blank");
  };

  const siteCount = useMemo(() => sites.length, [sites]);
  const facilities = nearby?.results || [];

  const smartAlerts = useMemo(
    () => buildSmartAlerts(selected, weather, facilities.length),
    [selected, weather, facilities]
  );

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        background: "#f8fafc",
        minHeight: "100vh",
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: 20 }}>
        <header
          style={{
            display: "grid",
            gap: 18,
            gridTemplateColumns: "1.45fr 1fr",
            alignItems: "center",
            padding: 24,
            borderRadius: 24,
            background:
              "linear-gradient(135deg, rgba(15,23,42,1) 0%, rgba(30,64,175,1) 55%, rgba(6,182,212,1) 100%)",
            color: "white",
            boxShadow: "0 16px 40px rgba(15,23,42,0.18)",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-block",
                padding: "6px 12px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.14)",
                fontSize: 12,
                fontWeight: 800,
                marginBottom: 14,
              }}
            >
              Heritage Health Hub • Stage 3
            </div>

            <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.08 }}>
              Zimbabwe’s smart tourism health and heritage intelligence platform
            </h1>

            <p
              style={{
                marginTop: 14,
                marginBottom: 0,
                maxWidth: 760,
                color: "rgba(255,255,255,0.92)",
                lineHeight: 1.65,
                fontSize: 15,
              }}
            >
              Heritage Health Hub combines tourism, public health, maps, live weather, smart alerts,
              and nearby care access into one platform that helps visitors explore Zimbabwe more
              safely while supporting a scalable startup model for tourism innovation.
            </p>

            <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={detectLocation}
                style={{
                  border: "none",
                  background: "white",
                  color: "#1d4ed8",
                  padding: "11px 15px",
                  borderRadius: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Detect My Location
              </button>

              <button
                onClick={() => setShowAdmin(true)}
                style={{
                  border: "1px solid rgba(255,255,255,0.35)",
                  background: "transparent",
                  color: "white",
                  padding: "11px 15px",
                  borderRadius: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Admin
              </button>

              <button
                onClick={loadSites}
                style={{
                  border: "1px solid rgba(255,255,255,0.35)",
                  background: "transparent",
                  color: "white",
                  padding: "11px 15px",
                  borderRadius: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Refresh
              </button>
            </div>

            {gpsStatus ? (
              <div style={{ marginTop: 12, fontSize: 13, color: "rgba(255,255,255,0.9)" }}>
                {gpsStatus}
              </div>
            ) : null}
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 20,
              padding: 18,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.95 }}>Investor / VC Snapshot</div>

            <div
              style={{
                marginTop: 14,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 11, opacity: 0.9 }}>Problem</div>
                <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6 }}>
                  Tourism safety information is fragmented
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 11, opacity: 0.9 }}>Solution</div>
                <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6 }}>
                  Unified health-aware tourism platform
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 11, opacity: 0.9 }}>Model</div>
                <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6 }}>
                  SaaS + tourism partnerships
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 11, opacity: 0.9 }}>Use Case</div>
                <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6 }}>
                  Visitors, institutions, and travel operators
                </div>
              </div>
            </div>
          </div>
        </header>

        <section
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          <StatCard
            label="Integrated Sites"
            value={siteCount}
            note="Tourist and heritage sites currently available in the platform."
          />
          <StatCard
            label="Heritage Sites"
            value={heritageCount}
            note="Cultural and historical destinations enhanced with health-aware visitor guidance."
          />
          <StatCard
            label="Tourist Destinations"
            value={touristCount}
            note="Nature and tourism experiences covered with maps, weather, and nearby care access."
          />
          <StatCard
            label="Province Coverage"
            value={provinceCount}
            note="Geographic spread of destinations currently supported by the platform."
          />
        </section>

        <section
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          <FeatureCard
            title="Tourism + Health Integration"
            text="The platform combines destination discovery with live weather, risk alerts, care access, and site-specific safety guidance."
          />
          <FeatureCard
            title="Commercialization Potential"
            text="The model can scale through tourism board partnerships, sponsored care providers, premium data services, and institutional dashboards."
          />
          <FeatureCard
            title="Public Value"
            text="Visitors make better decisions, tourism operators improve trust, and institutions gain a digital layer for safer tourism engagement."
          />
        </section>

        <section
          style={{
            marginTop: 18,
            padding: 18,
            borderRadius: 18,
            background: "white",
            border: "1px solid #e5e7eb",
            boxShadow: "0 10px 24px rgba(15,23,42,0.04)",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 20 }}>Zimbabwe Heritage & Tourism Coverage Map</div>
          <div style={{ marginTop: 6, color: "#6b7280", fontSize: 14 }}>
            National overview of destinations currently integrated into Heritage Health Hub.
          </div>

          <div style={{ marginTop: 14 }}>
            <MapContainer
              center={[-19.0154, 29.1549]}
              zoom={6}
              style={{ height: 420, width: "100%", borderRadius: 16 }}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {sites.map((site) => (
                <Marker key={site.id} position={[site.latitude, site.longitude]}>
                  <Popup>
                    <div style={{ fontWeight: 800 }}>{site.name}</div>
                    <div style={{ fontSize: 12 }}>{site.category}</div>
                    <div style={{ marginTop: 6, fontSize: 12 }}>{site.province}</div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </section>

        <section
          style={{
            marginTop: 18,
            padding: 18,
            borderRadius: 18,
            background: "white",
            border: "1px solid #e5e7eb",
            boxShadow: "0 10px 24px rgba(15,23,42,0.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: 20 }}>Site Explorer</div>
              <div style={{ marginTop: 4, color: "#6b7280", fontSize: 14 }}>
                Search destinations by site name, province, category, summary, or health guidance.
              </div>
            </div>

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sites..."
              style={{
                minWidth: 300,
                border: "1px solid #d1d5db",
                borderRadius: 12,
                padding: "12px 14px",
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>
        </section>

        <div style={{ marginTop: 20 }}>
          {loadingSites && <p>Loading sites...</p>}

          {err && (
            <div
              style={{
                padding: 14,
                borderRadius: 14,
                border: "1px solid #fecdd3",
                background: "#fff1f2",
                color: "#be123c",
              }}
            >
              {err}
            </div>
          )}

          {!loadingSites && !err && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 16,
              }}
            >
              {filteredSites.map((site) => {
                const riskStyle = getRiskStyle(site.risk_level);

                return (
                  <div
                    key={site.id}
                    style={{
                      background: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: 18,
                      overflow: "hidden",
                      boxShadow: "0 10px 24px rgba(15,23,42,0.04)",
                    }}
                  >
                    <div
                      style={{
                        height: 180,
                        background: "#eef2ff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      {site.image_url ? (
                        <img
                          src={site.image_url}
                          alt={site.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <div style={{ padding: 20, textAlign: "center", color: "#4b5563" }}>
                          Heritage Health Hub
                        </div>
                      )}
                    </div>

                    <div style={{ padding: 16 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          alignItems: "start",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 12, color: "#6b7280" }}>
                            {site.category?.toUpperCase()} • {site.province}
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>
                            {site.name}
                          </div>
                        </div>

                        <div
                          style={{
                            ...riskStyle,
                            padding: "6px 10px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 800,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {riskStyle.label}
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: 10,
                          fontSize: 13,
                          color: "#4b5563",
                          minHeight: 58,
                          lineHeight: 1.55,
                        }}
                      >
                        {site.summary || "Explore this destination with live weather, care access, and site-specific health support."}
                      </div>

                      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button
                          onClick={() => openSite(site)}
                          style={{
                            border: "none",
                            background: "#111827",
                            color: "white",
                            padding: "10px 12px",
                            borderRadius: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          View Details
                        </button>

                        <button
                          onClick={() =>
                            openGoogleRoute(site.latitude, site.longitude, site.latitude, site.longitude)
                          }
                          style={{
                            border: "1px solid #d1d5db",
                            background: "white",
                            color: "#111827",
                            padding: "10px 12px",
                            borderRadius: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Open in Maps
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.55)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-end",
            padding: 14,
            zIndex: 9998,
          }}
          onClick={closeDetails}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 1180,
              background: "#ffffff",
              borderRadius: 22,
              padding: 18,
              maxHeight: "90vh",
              overflow: "auto",
              boxShadow: "0 20px 44px rgba(0,0,0,0.22)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "start",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {selected.category?.toUpperCase()} • {selected.province}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, marginTop: 5 }}>{selected.name}</div>
                <div style={{ marginTop: 6, fontSize: 13, color: "#6b7280" }}>
                  Coordinates: {selected.latitude}, {selected.longitude}
                </div>
              </div>

              <button
                onClick={closeDetails}
                style={{
                  border: "1px solid #d1d5db",
                  background: "white",
                  padding: "10px 12px",
                  borderRadius: 12,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Close
              </button>
            </div>

            <hr style={{ margin: "18px 0" }} />

            {loadingDetails && <div style={{ color: "#4b5563" }}>Loading site intelligence...</div>}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr",
                gap: 16,
              }}
            >
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 18,
                  overflow: "hidden",
                  background: "white",
                }}
              >
                <div style={{ height: 320, background: "#eef2ff" }}>
                  <img
                    src={selected.image_url || wiki?.thumbnail || "https://placehold.co/1200x600?text=Heritage+Health+Hub"}
                    alt={selected.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>

                <div style={{ padding: 16 }}>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>Site Summary</div>
                  <div style={{ marginTop: 10, color: "#4b5563", lineHeight: 1.7, fontSize: 14 }}>
                    {selected.summary || wiki?.extract || "Site summary unavailable."}
                  </div>

                  {wiki?.content_urls?.desktop?.page ? (
                    <a
                      href={wiki.content_urls.desktop.page}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-block",
                        marginTop: 12,
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#1d4ed8",
                        textDecoration: "none",
                      }}
                    >
                      Read more
                    </a>
                  ) : null}
                </div>
              </div>

              <div style={{ display: "grid", gap: 14 }}>
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 18,
                    padding: 16,
                    background: "white",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 17 }}>Site Health Intelligence</div>

                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>Risk Level</div>
                    <div
                      style={{
                        marginTop: 6,
                        display: "inline-block",
                        ...getRiskStyle(selected.risk_level),
                        padding: "8px 12px",
                        borderRadius: 999,
                        fontWeight: 800,
                        fontSize: 12,
                      }}
                    >
                      {selected.risk_level || "Moderate"}
                    </div>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>Smart Health Tip</div>
                    <div style={{ marginTop: 6, color: "#374151", lineHeight: 1.6, fontSize: 14 }}>
                      {selected.health_tip || "No health tip available."}
                    </div>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>Recommended Items</div>
                    <div style={{ marginTop: 6, color: "#374151", lineHeight: 1.6, fontSize: 14 }}>
                      {selected.recommended_items || "Water, walking shoes, and weather protection."}
                    </div>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>Emergency Note</div>
                    <div style={{ marginTop: 6, color: "#374151", lineHeight: 1.6, fontSize: 14 }}>
                      {selected.emergency_note || "Seek the nearest clinic or health facility if needed."}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 18,
                    padding: 16,
                    background: "white",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 17 }}>Weather Insights</div>

                  {weather?.current ? (
                    <div style={{ marginTop: 12, color: "#374151", lineHeight: 1.8 }}>
                      <div>Temperature: <b>{weather.current.temperature_2m}°C</b></div>
                      <div>Feels like: <b>{weather.current.apparent_temperature}°C</b></div>
                      <div>Wind: <b>{weather.current.wind_speed_10m} km/h</b></div>
                      <div>Rain: <b>{weather.current.precipitation} mm</b></div>

                      <div
                        style={{
                          marginTop: 12,
                          padding: 12,
                          background: "#f8fafc",
                          border: "1px solid #e5e7eb",
                          borderRadius: 14,
                          fontSize: 14,
                        }}
                      >
                        <b>Wear Suggestion:</b> {weather.wear_suggestion}
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 12, color: "#6b7280" }}>Weather data unavailable.</div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 12 }}>Real-Time Smart Health Alerts</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 12,
                }}
              >
                {smartAlerts.map((alert, idx) => (
                  <AlertCard key={idx} title={alert.title} text={alert.text} tone={alert.tone} />
                ))}
              </div>
            </div>

            <div
              style={{
                marginTop: 16,
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr",
                gap: 16,
              }}
            >
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 18,
                  padding: 16,
                  background: "white",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 18 }}>Live Map Intelligence</div>

                <div style={{ marginTop: 12 }}>
                  <MapContainer
                    center={[selected.latitude, selected.longitude]}
                    zoom={10}
                    style={{ height: 380, width: "100%", borderRadius: 14 }}
                  >
                    <TileLayer
                      attribution='&copy; OpenStreetMap contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    <Marker position={[selected.latitude, selected.longitude]}>
                      <Popup>{selected.name}</Popup>
                    </Marker>

                    {userLocation ? (
                      <Marker position={[userLocation.lat, userLocation.lon]}>
                        <Popup>You are here</Popup>
                      </Marker>
                    ) : null}

                    {facilities.slice(0, 20).map((f, i) => (
                      <Marker key={i} position={[f.lat, f.lon]}>
                        <Popup>
                          <div style={{ fontWeight: 800 }}>{f.name}</div>
                          <div style={{ fontSize: 12 }}>{f.type}</div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {userLocation ? (
                    <button
                      onClick={() =>
                        openGoogleRoute(userLocation.lat, userLocation.lon, selected.latitude, selected.longitude)
                      }
                      style={{
                        border: "none",
                        background: "#111827",
                        color: "white",
                        padding: "10px 12px",
                        borderRadius: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Route from my location to site
                    </button>
                  ) : (
                    <button
                      onClick={detectLocation}
                      style={{
                        border: "none",
                        background: "#2563eb",
                        color: "white",
                        padding: "10px 12px",
                        borderRadius: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Enable GPS
                    </button>
                  )}
                </div>
              </div>

              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 18,
                  padding: 16,
                  background: "white",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 18 }}>Nearby Clinics, Hospitals & Pharmacies</div>

                <div style={{ marginTop: 12, color: "#6b7280", fontSize: 13 }}>
                  {facilities.length} facility/facilities found nearby
                </div>

                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {facilities.length ? (
                    facilities.slice(0, 8).map((facility, idx) => (
                      <div
                        key={idx}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 14,
                          padding: 12,
                          background: "#fafafa",
                        }}
                      >
                        <div style={{ fontWeight: 800 }}>{facility.name}</div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                          {facility.type}
                        </div>

                        {facility.address ? (
                          <div style={{ marginTop: 6, fontSize: 13, color: "#4b5563" }}>
                            {facility.address}
                          </div>
                        ) : null}

                        <div style={{ marginTop: 10 }}>
                          {userLocation ? (
                            <button
                              onClick={() =>
                                openGoogleRoute(userLocation.lat, userLocation.lon, facility.lat, facility.lon)
                              }
                              style={{
                                width: "100%",
                                border: "none",
                                background: "#111827",
                                color: "white",
                                padding: "10px 12px",
                                borderRadius: 10,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Route from my location
                            </button>
                          ) : (
                            <button
                              onClick={detectLocation}
                              style={{
                                width: "100%",
                                border: "1px solid #d1d5db",
                                background: "white",
                                color: "#111827",
                                padding: "10px 12px",
                                borderRadius: 10,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Enable GPS to route
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: "#6b7280" }}>No nearby health facilities were returned.</div>
                  )}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                padding: 14,
                borderRadius: 16,
                background: "#f8fafc",
                border: "1px solid #e5e7eb",
                color: "#4b5563",
                fontSize: 13,
              }}
            >
              Stage 3 presentation mode: startup landing page, impact metrics, Zimbabwe coverage map,
              site intelligence, smart alerts, nearby care support, and GPS-enabled tourism safety.
            </div>
          </div>
        </div>
      )}

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