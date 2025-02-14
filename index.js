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
// SECTION: Map Initialization and Setup
// -----------------------------------------------------------------------------

function initMap(lat, long, zoom_level) {
    map = L.map('map').setView([lat, long], zoom_level);
    BASE_LAYERS.OpenStreetMap.addTo(map);
    map.addControl(createSearchControl());
    setupLayerOrderRules();
}

function createSearchControl() {
    return new L.Control.Search({
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
}

function setupLayerOrderRules() {
    map.on('layeradd', () => {
        legislativeLayer?.bringToFront();
        tribalBoundariesLayer?.bringToFront();
    });
}

// -----------------------------------------------------------------------------
// SECTION: Data Loading and Layer Management
// -----------------------------------------------------------------------------

function initBoundaryLayers(layersConfig) {
    if (layersConfig.County) initGeoJsonLayer(BOUNDARY_LAYER_PATHS.COUNTY, handleCountyData);
    if (layersConfig.Legislative) initGeoJsonLayer(BOUNDARY_LAYER_PATHS.LEGISLATIVE, handleLegislativeData);
    if (layersConfig.Precinct) initGeoJsonLayer(BOUNDARY_LAYER_PATHS.PRECINCT, handlePrecinctData);
    if (layersConfig.Tribal) initGeoJsonLayer(BOUNDARY_LAYER_PATHS.TRIBAL, handleTribalData);
}

function initSymbolLayers() {
    initGeoJsonLayer(SYMBOL_LAYER_PATHS.POLLING_LOCATIONS, populatePollingLocations);
    initGeoJsonLayer(SYMBOL_LAYER_PATHS.POST_OFFICES, handlePostOfficeData);
}

function initGeoJsonLayer(path, callback) {
    axios.get(path)
        .then(response => callback(response.data))
        .catch(error => console.error(`Error loading ${path}`, error));
}

// -----------------------------------------------------------------------------
// SECTION: County Management
// -----------------------------------------------------------------------------

function handleCountyData(data) {
    countyData = data;
    countyLayer = createCountyLayer(data);
    countyLayer.addTo(map);
    populateCountySelector(data.features);
    map.fitBounds(countyLayer.getBounds());
    addEventListener.countyCheckBox(map, countyLayer, highlightedCountyLayer);
}

function createCountyLayer(data) {
    return L.geoJson(data, {
        style: feature => ({
            color: ALLOWED_COUNTIES.includes(feature.properties.NAME) ? "#ff7800" : "#000000",
            weight: ALLOWED_COUNTIES.includes(feature.properties.NAME) ? 2 : 0.5,
            opacity: ALLOWED_COUNTIES.includes(feature.properties.NAME) ? 1 : 0.5,
            fillOpacity: 0,
        }),
        onEachFeature: (feature, layer) => {
            layer.on('click', () => {
                ELEMENTS.countyDropdown.value = feature.properties.NAME;
                highlightCounty(feature.properties.NAME);
            });
        },
    });
}

// -----------------------------------------------------------------------------
// SECTION: Event Handlers and UI Updates
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
// Initialization
// -----------------------------------------------------------------------------

function initializeApplication() {
    initMap(46.8772, -96.7898, 7);
    initBoundaryLayers({ County: true, Tribal: true, Legislative: true, Precinct: true });
    initSymbolLayers();
    setupMapInteractions();
    initLegend();
    loadCountyAuditorInfo(COUNTY_DATASOURCE_PATHS.COUNTY_AUDITOR);
    hideCountyAuditorInfoTable();
}

initializeApplication();

