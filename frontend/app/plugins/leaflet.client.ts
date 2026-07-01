// app/plugins/leaflet.client.ts
// Client-only: load Leaflet + markercluster stylesheets and repoint the default marker
// icon URLs at the copies under /public/leaflet (bundlers otherwise mangle the paths).
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import L from 'leaflet'

export default defineNuxtPlugin(() => {
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: '/leaflet/marker-icon-2x.png',
    iconUrl: '/leaflet/marker-icon.png',
    shadowUrl: '/leaflet/marker-shadow.png',
  })
})
