/**
 * NDNV Election Web Application
 */

import { 
    ELEMENTS, 
    COUNTY_DATASOURCE_PATHS,
    ALLOWED_COUNTIES 
} from '../config/constants.js';

import { GeocodingManager } from './GeocodingManager.js';
import { LegendManager } from './LegendManager.js';
import { MarkerManager } from './MarkerManager.js';
import { BaseMap } from './BaseMap.js';
import { LayerManager } from './LayerManager.js';

class ElectionApp {
constructor() {
    this.baseMap = new BaseMap(46.8772, -96.7898, 7);
    this.layerManager = new LayerManager(this.baseMap.map);
    this.markerManager = new MarkerManager(this.baseMap.map);
    this.geocodingManager = new GeocodingManager();
    this.legendManager = new LegendManager();
    this.countyAuditorInfo = {};
    
    this.initializeApp();
}

async initializeApp() {
    await this.layerManager.initializeLayers({
        County: true,
        Tribal: true,
        Legislative: true,
        Precinct: true,
    });
    
    await this.markerManager.populatePollingLocations();
    this.initializeControls();
    this.initializeLegend();
    this.initializeEventListeners();
    await this.loadCountyAuditorInfo();
    
    this.baseMap.addLayerRule();
}

async loadCountyAuditorInfo() {
    try {
        const result = await new Promise((resolve, reject) => {
            Papa.parse(COUNTY_DATASOURCE_PATHS.COUNTY_AUDITOR, {
                download: true,
                header: true,
                complete: resolve,
                error: reject
            });
        });
        
        result.data.forEach((row) => {
            this.countyAuditorInfo[row.County] = row;
        });
        this.populateCountySelector(result.data);
    } catch (error) {
        console.error('Error loading county auditor info:', error);
    }
}

initializeControls() {
    this.initializeCheckBoxStates();
    this.initializeCountySelector();
}

initializeCheckBoxStates() {
    ELEMENTS.precinctCheckbox.checked = true;
    ELEMENTS.countyCheckbox.checked = true;
    ELEMENTS.countyCheckbox.disabled = true;
}

initializeCountySelector() {
    ELEMENTS.countyDropdown.addEventListener('change', (e) => {
        this.layerManager.clearAllPrecinctsOnMap();
        const selectedCounty = e.target.value;
        
        if (!selectedCounty) {
            this.layerManager.clearHighlightedCounty();
            this.hideCountyAuditorInfoTable();
        } else {
            const bounds = L.geoJson(this.layerManager.getCountyFeatureByName(selectedCounty)).getBounds();
            this.baseMap.fitBounds(bounds);
            this.layerManager.highlightCounty(selectedCounty);
        }
    });
}

initializeLegend() {
    this.legendManager.createLayersLegend();
    this.legendManager.createIconLegend();
}

initializeEventListeners() {
    this.baseMap.map.on('click', this.handleMapClick.bind(this));
    this.baseMap.map.on('zoomend', this.handleZoomEnd.bind(this));
}

async handleMapClick(e) {
    this.layerManager.clearAllPrecinctsOnMap();
    this.markerManager.clearHighlightedPollLocations();
    this.layerManager.clearHighlightedCounty();
    this.setPlaceholderAddress();
    this.markerManager.clearCurrentMarker();

    const county = this.getGeographicalFeature(e.latlng.lat, e.latlng.lng, this.layerManager.data.county, 'NAME');
    const precinct = this.getGeographicalFeature(e.latlng.lat, e.latlng.lng, this.layerManager.data.precinct, 'Name');
    const district = this.getGeographicalFeature(e.latlng.lat, e.latlng.lng, this.layerManager.data.legislative, 'DISTRICT');

    this.baseMap.zoomToCoords(e.latlng, 8);
    ELEMENTS.countyDropdown.value = county || "";

    if (county) {
        this.displayCountyAuditorInfo(county);
        this.markerManager.placeMarker(e.latlng, precinct, district);
        this.layerManager.showPrecinctsForCounty(county);
    } else {
        this.hideCountyAuditorInfoTable();
    }

    if (ALLOWED_COUNTIES.includes(county)) {
        this.layerManager.highlightCounty(county);
    }
    
    this.markerManager.highlightPollingLocationForPrecinct(precinct);
    
    const address = await this.geocodingManager.reverseGeocode(e.latlng.lat, e.latlng.lng);
    this.displayAddress(address);
}

handleZoomEnd() {
    this.markerManager.updateIconsOnZoom();
}

getGeographicalFeature(lat, lng, data, propertyName) {
    const point = turf.point([lng, lat]);
    let result = null;

    turf.featureEach(data, currentFeature => {
        if (turf.booleanPointInPolygon(point, currentFeature)) {
            result = currentFeature.properties[propertyName];
        }
    });

    return result;
}

populateCountySelector(data) {
    data.forEach(row => {
        const option = Object.assign(document.createElement('option'), {
            value: row.County,
            textContent: row.County
        });
        ELEMENTS.countyDropdown.appendChild(option);
    });
}

displayCountyAuditorInfo(countyName) {
    const countyAuditor = this.countyAuditorInfo[countyName];
    if (!countyAuditor) return this.hideCountyAuditorInfoTable();

    this.showCountyAuditorInfoTable();
    ELEMENTS.countyAuditorInfoTable.rows[0].cells[1].textContent = countyAuditor.County;
    ELEMENTS.countyAuditorInfoTable.rows[1].cells[1].textContent = countyAuditor.Auditor;
    ELEMENTS.countyAuditorInfoTable.rows[2].cells[1].textContent = countyAuditor['Phone/Fax/Email'];
    ELEMENTS.countyAuditorInfoTable.rows[3].cells[1].textContent = countyAuditor.Address;
}

showCountyAuditorInfoTable() {
    ELEMENTS.countyAuditorInfoTable.style.display = 'block';
}

hideCountyAuditorInfoTable() {
    ELEMENTS.countyAuditorInfoTable.style.display = 'none';
}

setPlaceholderAddress() {
    ELEMENTS.addressDisplay.textContent = 'Fetching address...';
}

displayAddress(address) {
    ELEMENTS.addressDisplay.innerHTML = address ? 
        `<span style="color: #666; font-weight: 500;">Approximate address:&nbsp</span>${address}` :
        'Address not found';
}
}

// Initialize the application
const app = new ElectionApp();

export default ElectionApp;