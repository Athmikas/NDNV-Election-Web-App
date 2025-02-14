


import { 
    BASE_LAYERS
} from '../config/constants.js';

export class BaseMap {
    constructor(lat, long, zoom_level) {
        this.map = L.map('map').setView([lat, long], zoom_level);
        this.marker = null;
        this.initializeSearchControl();
        this.initializeBaseLayer();
    }

    initializeSearchControl() {
        this.searchControl = new L.Control.Search({
            url: 'https://nominatim.openstreetmap.org/search?format=json&q={s}',
            jsonpParam: 'json_callback',
            propertyName: 'display_name',
            propertyLoc: ['lat', 'lon'],
            marker: false,
            autoCollapse: true,
            autoType: false,
            minLength: 2,
            position: 'topright',
        });

        this.searchControl.on('search:locationfound', (e) => {
            this.placeMarker(e.latlng);
            this.reverseGeocode(e.latlng.lat, e.latlng.lng);
        });

        this.map.addControl(this.searchControl);
    }

    initializeBaseLayer() {
        BASE_LAYERS["OpenStreetMap"].addTo(this.map);
    }

    setView(latlng, zoom) {
        this.map.setView(latlng, zoom);
    }

    fitBounds(bounds) {
        this.map.fitBounds(bounds);
    }

    zoomToCoords(latlng, threshold) {
        this.setView(latlng, this.map.getZoom() < threshold ? threshold : this.map.getZoom());
    }

    addLayerRule() {
        this.map.on('layeradd', () => {
            if (this.layerManager) {
                this.layerManager.layers.legislative?.bringToFront();
                this.layerManager.layers.tribal?.bringToFront();
            }
        });
    }
}
