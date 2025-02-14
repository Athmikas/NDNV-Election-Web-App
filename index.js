// Import necessary modules and constants
import {
    BASE_LAYERS, ELEMENTS, STYLES, BOUNDARY_LAYER_PATHS,
    SYMBOL_LAYER_PATHS, COUNTY_DATASOURCE_PATHS, ICON_PATHS, ALLOWED_COUNTIES
} from './constants.js';
import { addEventListener } from './eventListeners.js';

// -----------------------------------------------------------------------------
// SECTION: Module-Level Variables
// -----------------------------------------------------------------------------
let map, marker, countyLayer, legislativeLayer, highlightedCountyLayer, tribalBoundariesLayer;
let precinctLayers = [], highlightedPollLocMarkers = [], pollingLocationMarkers = [], postOfficeIconMarkers = [];
let pollLocMarkerMap = {};

let precinctData, countyData, legislativeData, tribalBoundariesData;
const countyAuditorInfo = {};

let cancelTokenSource = null;
let notHighlightedPolLocIcon, highlightedPolLocIcon, postOfficeIcon;

// -----------------------------------------------------------------------------
// SECTION: Core Functions 
// -----------------------------------------------------------------------------
function clearHighlightedCounty() {
    highlightedCountyLayer && map.removeLayer(highlightedCountyLayer);
}

function highlightCounty(countyName) {
    clearHighlightedCounty();
    if (!ELEMENTS.countyCheckbox?.checked) return;

    const selectedCountyFeature = getCountyFeatureByName(countyName);
    if (!selectedCountyFeature || !ALLOWED_COUNTIES.includes(countyName)) return;

    highlightedCountyLayer = L.geoJson(selectedCountyFeature, {
        style: STYLES.HIGHLIGHTED_COUNTY,
    }).addTo(map);
}

function getCountyFeatureByName(countyName) {
    return countyData?.features?.find(feature => feature.properties.NAME === countyName);
}

function populateCountySelector(data) {
    if (!ELEMENTS.countyDropdown) {
        console.error('County dropdown element not found');
        return;
    }

    data.forEach(item => {
        const countyName = item.properties?.NAME || item.County;
        if (countyName) {
            const option = document.createElement('option');
            option.value = countyName;
            option.textContent = countyName;
            ELEMENTS.countyDropdown.appendChild(option);
        }
    });
}

// -----------------------------------------------------------------------------
// SECTION: Map Initialization and Setup
// -----------------------------------------------------------------------------
function initMap(lat, long, zoom_level) {
    map = L.map('map').setView([lat, long], zoom_level);
    BASE_LAYERS.OpenStreetMap.addTo(map);
    map.addControl(createSearchControl());
    setupLayerOrderRules();
}

function createSearchControl() {
    const control = new L.Control.Search({
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

    control.on('search:locationfound', (e) => {
        placeMarker(e.latlng);
        reverseGeocode(e.latlng.lat, e.latlng.lng);
    });

    return control;
}

// -----------------------------------------------------------------------------
// SECTION: Data Loading and Layer Management
// -----------------------------------------------------------------------------
function initBoundaryLayers(layersConfig) {
    if (layersConfig.County) initCountyLayer(BOUNDARY_LAYER_PATHS.COUNTY);
    if (layersConfig.Legislative) initLegislativeLayer(BOUNDARY_LAYER_PATHS.LEGISLATIVE);
    if (layersConfig.Precinct) initPrecinctLayer(BOUNDARY_LAYER_PATHS.PRECINCT);
    if (layersConfig.Tribal) initTribalLayer(BOUNDARY_LAYER_PATHS.TRIBAL);
}

function initCountyLayer(path) {
    axios.get(path)
        .then(response => {
            countyData = response.data;
            addCountyLayerToMap(countyData);
            populateCountySelector(countyData.features);
            map.fitBounds(countyLayer.getBounds());
            addEventListener.countyCheckBox(map, countyLayer, highlightedCountyLayer);
        })
        .catch(error => console.error('County layer loading failed:', error));
}

function initLegislativeLayer(path) {
    axios.get(path)
        .then(response => {
            legislativeData = response.data;
            legislativeLayer = L.geoJson(legislativeData, { 
                style: STYLES.LEGISLATIVE_LAYER 
            });
            addEventListener.legislativeCheckBox(map, legislativeLayer);
        })
        .catch(error => console.error('Legislative layer loading failed:', error));
}

function initTribalLayer(path) {
    axios.get(path)
        .then(response => {
            tribalBoundariesData = response.data;
            tribalBoundariesLayer = L.geoJson(response.data, {
                style: STYLES.TRIBAL_BOUNDARIES,
                onEachFeature: addTribalLandLabel,
            });
            addEventListener.tribalBoundariesCheckBox(map, tribalBoundariesLayer);
        })
        .catch(error => console.error('Tribal layer loading failed:', error));
}

function initPrecinctLayer(path) {
    axios.get(path)
        .then(response => {
            precinctData = response.data;
            ELEMENTS.precinctCheckbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    ELEMENTS.countyCheckbox.checked = true;
                    ELEMENTS.countyCheckbox.disabled = true;
                    showPrecinctsForCounty(ELEMENTS.countyDropdown.value);
                    countyLayer.addTo(map);
                } else {
                    ELEMENTS.countyCheckbox.disabled = false;
                    clearAllPrecinctsOnMap();
                }
            });
        })
        .catch(error => console.error('Precinct layer loading failed:', error));
}

// -----------------------------------------------------------------------------
// SECTION: Symbol Layers
// -----------------------------------------------------------------------------
function initSymbolLayers() {
    initPollingLocationLayer(SYMBOL_LAYER_PATHS.POLLING_LOCATIONS);
    initPostOfficeLayer(SYMBOL_LAYER_PATHS.POST_OFFICES);
}

function initPollingLocationLayer(path) {
    axios.get(path)
        .then(response => populatePollingLocations(response.data))
        .catch(error => console.error('Polling locations loading failed:', error));
}

function initPostOfficeLayer(path) {
    axios.get(path)
        .then(response => {
            ELEMENTS.postOfficesCheckBox.addEventListener('change', function(e) {
                e.target.checked ? populatePostOffices(response.data) : clearPostOffices();
            });
        })
        .catch(error => console.error('Post offices loading failed:', error));
}

// -----------------------------------------------------------------------------
// SECTION: UI Components and Interactions
// -----------------------------------------------------------------------------
function setupMapInteractions() {
    map.on('click', handleMapClick);
    map.on('zoomend', updateDynamicIcons);
}

function handleMapClick(e) {
    clearAllPrecinctsOnMap();
    clearHighlightedPollLocations();
    clearHighlightedCounty();
    setPlaceholderAddress();
    clearCurrentMarker();

    const county = getGeographicalFeature(e.latlng.lat, e.latlng.lng, countyData, 'NAME');
    const precinct = getGeographicalFeature(e.latlng.lat, e.latlng.lng, precinctData, 'Name');
    const district = getGeographicalFeature(e.latlng.lat, e.latlng.lng, legislativeData, 'DISTRICT');

    updateUIForLocation(e.latlng, county, precinct, district);
}

function updateUIForLocation(latlng, county, precinct, district) {
    zoomToCoords(latlng, 8);
    ELEMENTS.countyDropdown.value = county || "";

    if (county) {
        displayCountyAuditorInfo(county);
        placeMarker(latlng, precinct, district);
        showPrecinctsForCounty(county);
        highlightCounty(county);
    }
    
    highlightPollingLocationForPrecinct(precinct);
    reverseGeocode(latlng.lat, latlng.lng);
}

// -----------------------------------------------------------------------------
// SECTION: Helper Functions
// -----------------------------------------------------------------------------
function createDynamicIcon(zoomLevel, iconPath, scale = 1, minSize = 5, maxSize = 50) {
    const size = Math.min(maxSize, Math.max(minSize, zoomLevel * scale + minSize));
    return L.icon({
        iconUrl: iconPath,
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [1, -size / 2],
    });
}

function updateDynamicIcons() {
    notHighlightedPolLocIcon = createDynamicIcon(map.getZoom(), ICON_PATHS.POLLING_LOCATION, 2, 10);
    highlightedPolLocIcon = createDynamicIcon(map.getZoom(), ICON_PATHS.HIGHLIGHTED_POLLING_LOCATION, 2, 10);
    postOfficeIcon = createDynamicIcon(map.getZoom(), ICON_PATHS.POST_OFFICE, 1, 5);

    updateMarkersIcon(pollingLocationMarkers, notHighlightedPolLocIcon);
    updateMarkersIcon(highlightedPollLocMarkers, highlightedPolLocIcon);
    updateMarkersIcon(postOfficeIconMarkers, postOfficeIcon);
}

function updateMarkersIcon(markers, icon) {
    markers.forEach(marker => marker.setIcon(icon));
}

// -----------------------------------------------------------------------------
// SECTION: Initialization Sequence
// -----------------------------------------------------------------------------
function initializeApplication() {
    initMap(46.8772, -96.7898, 7);
    initBoundaryLayers({ 
        County: true, 
        Tribal: true, 
        Legislative: true, 
        Precinct: true 
    });
    initSymbolLayers();
    setupMapInteractions();
    initLegend();
    loadCountyAuditorInfo(COUNTY_DATASOURCE_PATHS.COUNTY_AUDITOR);
    hideCountyAuditorInfoTable();
    
    // Initialize icons after map creation
    notHighlightedPolLocIcon = createDynamicIcon(map.getZoom(), ICON_PATHS.POLLING_LOCATION);
    highlightedPolLocIcon = createDynamicIcon(map.getZoom(), ICON_PATHS.HIGHLIGHTED_POLLING_LOCATION);
    postOfficeIcon = createDynamicIcon(map.getZoom(), ICON_PATHS.POST_OFFICE);
}

// Start the application
initializeApplication();


