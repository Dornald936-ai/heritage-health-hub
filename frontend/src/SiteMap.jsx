import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";

export default function SiteMap({ site, facilities }) {
  const position = [site.latitude, site.longitude];

  return (
    <MapContainer
      center={position}
      zoom={10}
      style={{ height: "400px", width: "100%", borderRadius: "12px" }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Heritage site marker */}
      <Marker position={position}>
        <Popup>{site.name}</Popup>
      </Marker>

      {/* Nearby clinics/hospitals */}
      {facilities?.map((f, i) => (
        <Marker key={i} position={[f.lat, f.lon]}>
          <Popup>{f.name}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}