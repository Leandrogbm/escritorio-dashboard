import React from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { COLORS } from "../lib/theme.js";

// Marcador colorido por temperatura — CircleMarker (SVG, sem ícone de imagem) evita o
// problema clássico do Leaflet com bundlers (ícone padrão quebrado por causa do jeito que
// o Vite resolve os assets do pacote) sem precisar mexer em L.Icon.Default.
const COR_STATUS = { quente: COLORS.wine, morno: COLORS.brass, frio: "#2563a3" };
const CENTRO_BRASIL = [-14.2, -51.9];

export default function LeadsMap({ leads, podeVerContato }) {
  const comCoordenada = leads.filter((l) => l.latitude != null && l.longitude != null);
  const centro = comCoordenada.length > 0 ? [comCoordenada[0].latitude, comCoordenada[0].longitude] : CENTRO_BRASIL;

  return (
    <div>
      <div style={{ height: 420, borderRadius: 8, overflow: "hidden", border: `1px solid ${COLORS.line}` }}>
        <MapContainer center={centro} zoom={comCoordenada.length > 0 ? 6 : 4} style={{ height: "100%", width: "100%" }}>
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {comCoordenada.map((l) => (
            <CircleMarker key={l.id} center={[l.latitude, l.longitude]} radius={9} pathOptions={{ color: "#fff", weight: 2, fillColor: COR_STATUS[l.status], fillOpacity: 0.9 }}>
              <Popup>
                <p style={{ fontWeight: 600 }}>{l.empresa || l.nome}</p>
                {l.empresa && <p style={{ fontSize: 12 }}>Responsável: {l.nome}</p>}
                <p style={{ fontSize: 12 }}>{l.cidade || "—"}</p>
                <p style={{ fontSize: 12, textTransform: "capitalize" }}>{l.status}</p>
                {podeVerContato ? (
                  <>
                    {l.contato && <p style={{ fontSize: 12 }}>Tel: {l.contato}</p>}
                    {l.email && <p style={{ fontSize: 12 }}>Email: {l.email}</p>}
                  </>
                ) : (
                  <p style={{ fontSize: 11, fontStyle: "italic", color: "#888" }}>Contato visível só pra admin/sócio</p>
                )}
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      {leads.length > comCoordenada.length && (
        <p className="text-xs mt-1" style={{ color: COLORS.slate }}>
          {leads.length - comCoordenada.length} lead(s) sem cidade/coordenada não aparece(m) no mapa.
        </p>
      )}
    </div>
  );
}
