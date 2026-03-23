import { MapContainer, Marker, TileLayer, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { LatLngExpression } from 'leaflet'
import { useEffect } from 'react'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Fix for missing marker assets in bundlers
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

type Props = {
  value: { lat: number; lng: number }
  center?: { lat: number; lng: number }
  onChange: (coords: { lat: number; lng: number }) => void
}

function ClickCatcher({ onChange }: { onChange: Props['onChange'] }) {
  useMapEvents({
    click(e) {
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

function Recenter({ center, value }: { center?: { lat: number; lng: number }; value: { lat: number; lng: number } }) {
  const map = useMap()
  useEffect(() => {
    const target = center || value
    map.setView([target.lat, target.lng])
  }, [center?.lat, center?.lng, value.lat, value.lng, map])
  return null
}

function MapPicker({ value, center, onChange }: Props) {
  const initialCenter: LatLngExpression = center || [value.lat, value.lng]

  return (
    <MapContainer center={initialCenter} zoom={12} scrollWheelZoom className="leaflet-container">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Recenter center={center} value={value} />
      <Marker position={[value.lat, value.lng]} />
      <ClickCatcher onChange={onChange} />
    </MapContainer>
  )
}

export default MapPicker
