import { 
    ELEMENTS, 
    SYMBOL_LAYER_PATHS, 
    COUNTY_DATASOURCE_PATHS,
    ICON_PATHS,
    ALLOWED_COUNTIES 
} from '../config/constants.js';

import { GeocodingManager } from './GeocodingManager.js';
import { LegendManager } from './LegendManager.js';

export class MarkerManager {
    constructor(map) {
        this.map = map;
        this.currentMarker = null;
        this.pollingLocationMarkers = [];
        this.highlightedPollLocMarkers = [];
        this.postOfficeMarkers = [];
        this.pollLocMarkerMap = {};
        this.initializeIcons();
    }

    initializeIcons() {
        this.icons = {
            notHighlightedPolLoc: this.createDynamicPollingIcon(
                this.map.getZoom(), 
                ICON_PATHS.POLLING_LOCATION, 
                2, 
                10
            ),
            highlightedPolLoc: this.createDynamicPollingIcon(
                this.map.getZoom(), 
                ICON_PATHS.HIGHLIGHTED_POLLING_LOCATION, 
                2, 
                10
            ),
            postOffice: this.createDynamicPollingIcon(
                this.map.getZoom(), 
                ICON_PATHS.POST_OFFICE, 
                1, 
                5
            )
        };
    }

    createDynamicPollingIcon(zoomLevel, iconUrl, scale, minSize) {
        const size = Math.min(Math.max(zoomLevel * scale + minSize, minSize), 50);
        return L.icon({
            iconUrl: iconUrl,
            iconSize: [size, size],
            iconAnchor: [size / 2, size],
            popupAnchor: [1, -size / 2],
        });
    }

    placeMarker(latlng, precinct, district) {
        this.clearCurrentMarker();
        
        const popupContent = `
            ${precinct ? `<b>Precinct:</b> ${precinct}<br>` : `Precinct information unavailable for this county. Check the <a href="https://www.sos.nd.gov/" target="_blank">ND SoS website</a>.<br><br>`}
            <b>District:</b> ${district || "N/A"}<br><br>
            ${latlng.lat.toFixed(2)}, ${latlng.lng.toFixed(2)}
        `;

        this.currentMarker = L.marker(latlng).addTo(this.map)
            .bindPopup(popupContent, {
                maxWidth: 200,
                maxHeight: 100,
            })
            .openPopup();
    }

    clearCurrentMarker() {
        if (this.currentMarker) {
            this.map.removeLayer(this.currentMarker);
            this.currentMarker = null;
        }
    }

    async populatePollingLocations() {
        try {
            const response = await axios.get(SYMBOL_LAYER_PATHS.POLLING_LOCATIONS);
            response.data.forEach(pollingLoc => {
                const precinctsList = this.getPrecinctsList(pollingLoc.Precincts_list);
                const pollingLocation = this.addSymbolMarker(
                    pollingLoc.latitude,
                    pollingLoc.longitude, 
                    this.icons.notHighlightedPolLoc
                );

                this.bindPopupToPollLocationMarker(pollingLocation, pollingLoc, precinctsList);
                this.updatePollLocMarkerMap(precinctsList, pollingLocation);
                this.addMarkerHoverEffect(pollingLocation);

                this.pollingLocationMarkers.push(pollingLocation);
            });
        } catch (error) {
            console.error('Error loading polling locations:', error);
        }
    }

async populatePostOffices() {
    try {
        const response = await axios.get(SYMBOL_LAYER_PATHS.POST_OFFICES);
        response.data.forEach(postOffice => {
            if (postOffice.x && postOffice.y) {
                const [lng, lat] = proj4('EPSG:3857', 'EPSG:4326', [postOffice.x, postOffice.y]);
                const postOfficeMarker = this.addSymbolMarker(lat, lng, this.icons.postOffice);
                postOfficeMarker.bindPopup(postOffice.ADDRESS);
                this.postOfficeMarkers.push(postOfficeMarker);
            } else {
                console.error("Invalid post office coordinates:", postOffice);
            }
        });
    } catch (error) {
        console.error('Error loading post offices:', error);
    }
}

addSymbolMarker(lat, long, icon) {
    return L.marker([lat, long], {
        icon: icon,
    }).addTo(this.map);
}

getPrecinctsList(precincts) {
    return String(precincts).split(',').map(precinct => precinct.trim());
}

bindPopupToPollLocationMarker(marker, pollingLoc, precinctsList) {
    marker.bindPopup(`
        <b>County:</b> ${pollingLoc.County}<br>
        <b>Polling Location:</b> ${pollingLoc.PollingLocation}<br>
        <b>Address:</b> ${pollingLoc.Address}<br>
        <b>City:</b> ${pollingLoc.City}<br>
        <b>Zip Code:</b> ${pollingLoc.ZipCode}<br>
        <b>Polling Hours:</b> ${pollingLoc.PollingHours}<br>
    `);
}

updatePollLocMarkerMap(precinctsList, marker) {
    precinctsList.forEach(precinct => {
        if (!this.pollLocMarkerMap[precinct]) {
            this.pollLocMarkerMap[precinct] = [];
        }
        this.pollLocMarkerMap[precinct].push(marker);
    });
}

addMarkerHoverEffect(marker) {
    // Desktop events
    marker.on('mouseover', function() {
        this.openPopup();
    });
    marker.on('mouseout', function() {
        this.closePopup();
    });

    // Mobile events
    marker.on('touchstart', function(e) {
        e.originalEvent.preventDefault();
        this.openPopup();
    });
    marker.on('touchend', function() {
        this.closePopup();
    });
}

highlightPollingLocationForPrecinct(precinct) {
    this.clearHighlightedPollLocations();
    if (!this.pollLocMarkerMap[precinct]) return;

    this.pollLocMarkerMap[precinct].forEach(marker => {
        marker.setIcon(this.icons.highlightedPolLoc);
        this.highlightedPollLocMarkers.push(marker);
    });
}

clearHighlightedPollLocations() {
    this.highlightedPollLocMarkers.forEach(marker => {
        marker.setIcon(this.icons.notHighlightedPolLoc);
    });
    this.highlightedPollLocMarkers = [];
}

clearPostOffices() {
    this.postOfficeMarkers.forEach(marker => {
        this.map.removeLayer(marker);
    });
    this.postOfficeMarkers = [];
}

updateIconsOnZoom() {
    this.initializeIcons();

    this.pollingLocationMarkers.forEach(marker => {
        marker.setIcon(this.icons.notHighlightedPolLoc);
    });

    this.highlightedPollLocMarkers.forEach(marker => {
        marker.setIcon(this.icons.highlightedPolLoc);
    });

    this.postOfficeMarkers.forEach(marker => {
        marker.setIcon(this.icons.postOffice);
    });
}
}