import { MapContainer, TileLayer, Polygon, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';

// --- 1. THE INVISIBLE PILOT ---
// This component now ONLY handles flying the camera to Siyarpali
function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 16, { 
        duration: 1.5 
      }); 
    }
  }, [center, map]);
  return null;
}

const Map = ({ plots, onPlotClick, center }) => {
  // Default coordinates if the system hasn't loaded Siyarpali yet
  const defaultCenter = [21.871, 83.493]; 

  return (
    <div className="h-full w-full border border-slate-800 rounded-lg overflow-hidden shadow-2xl relative z-0">
      <MapContainer 
        center={center || defaultCenter} 
        zoom={16} 
        className="h-full w-full"
        scrollWheelZoom={true}
      >
        {/* Manages the camera movement to the target plot */}
        <MapUpdater center={center} />
        
        {/* Live Google Satellite Layer */}
        <TileLayer
          url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
          attribution="&copy; Google Satellite"
        />
        
        {/* Render the Real Plots from Aayushi's GeoJSON */}
        {plots.map((plot, idx) => {
            // SAFEGUARD: Skip if coordinates are missing
            if (!plot.coordinates || !plot.coordinates[0]) return null;

            return (
              <Polygon
                key={idx}
                // SWAP LOGIC: GeoJSON is [Lng, Lat], Leaflet needs [Lat, Lng]
                positions={plot.coordinates[0].map(c => [c[1], c[0]])}
                pathOptions={{
                  // SYNC LOGIC: Turn Red if Satellite Analysis confirms violation
                  color: plot.is_violating ? '#ef4444' : '#10b981', 
                  fillColor: plot.is_violating ? '#ef4444' : '#10b981',
                  fillOpacity: 0.4,
                  weight: 2,
                  dashArray: plot.is_violating ? '5, 5' : null 
                }}
                eventHandlers={{
                  click: () => onPlotClick(plot),
                  mouseover: (e) => e.target.setStyle({ fillOpacity: 0.7 }),
                  mouseout: (e) => e.target.setStyle({ fillOpacity: 0.4 })
                }}
              >
                 <Popup className="font-sans text-slate-900">
                   <div className="p-1">
                     <p className="font-bold text-sm uppercase mb-1">{plot.plot_id}</p>
                     <p className="text-xs text-slate-500">SIYARPALI INDUSTRIAL AREA</p>
                   </div>
                 </Popup>
              </Polygon>
            );
        })}
      </MapContainer>
    </div>
  );
};

export default Map;