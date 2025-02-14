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

// -----------------------------------------------------------------------------
// SECTION: UI Components and Interactions
// -----------------------------------------------------------------------------
function populateCountySelector(data) {
    if (!ELEMENTS.countyDropdown) {
        console.error('County dropdown element not found');
        return;
    }

    data.forEach(item => {
        const countyName = item.properties?.NAME || item.County;
        if (countyName) {
            const option = new Option(countyName, countyName);
            ELEMENTS.countyDropdown.add(option);
        }
    });
}

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


