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
// SECTION: County Helper Functions 
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

function setupLayerOrderRules() {
    map.on('layeradd', () => {
        legislativeLayer?.bringToFront();
        tribalBoundariesLayer?.bringToFront();
    });
}

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
// SECTION: Icon Helper Functions
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
// SECTION: General Helper Functions
// -----------------------------------------------------------------------------

function addCountyLayerToMap(data) {
    countyLayer = L.geoJson(data, {
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
    }).addTo(map);
}

function clearCurrentMarker() {
    marker && map.removeLayer(marker);
}

function clearAllPrecinctsOnMap() {
    precinctLayers.forEach(layer => map.removeLayer(layer));
    precinctLayers = [];
    clearPrecinctsInLegend();
}

function clearPrecinctsInLegend() {
    ELEMENTS.precinctsLegendDiv.innerHTML = ELEMENTS.precinctCheckbox.checked ?
        'Precinct information currently unavailable for this county' :
        'Enable precinct layer and select county to view precincts';
}

function generatePrecinctColorMap(countyFeature) {
    const colors = [
        '#e6194b', '#ffe119', '#4363d8', '#f58231', '#201923', '#6B3E3E', '#fcff5d',
        '#8ad8e8', '#235b54', '#29bdab', '#3998f5', '#37294f', '#277da7', '#3750db',
        '#f22020', '#991919', '#ffcba5', '#e68f66', '#632819', '#c56133', '#ffc413',
        '#b732cc', '#772b9d', '#f47a22', '#2f2aa0', '#f07cab', '#d30b94', '#edeff3',
        '#c3a5b4', '#946aa2', '#5d4c86', '#96341c'
    ];
    const precinctColorMap = {};
    let colorIndex = 0;

    precinctData.features.forEach(feature => {
        if (feature.properties.County == countyFeature.properties.NAME) {
            const precinctName = feature.properties.Name;
            if (!precinctColorMap[precinctName]) {
                precinctColorMap[precinctName] = colors[colorIndex % colors.length];
                colorIndex++;
            }
        }
    });

    return precinctColorMap;
}

function showPrecinctColorsOnMap(precinctColorMap, countyFeature) {
    precinctData.features.forEach(feature => {
        if (feature.properties.County == countyFeature.properties.NAME) {
            const precinctName = feature.properties.Name;
            const layer = L.geoJson(feature, {
                style: () => ({
                    color: precinctColorMap[precinctName],
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.3,
                    fillColor: precinctColorMap[precinctName],
                }),
            }).addTo(map);
            precinctLayers.push(layer);
        }
    });
}

function showPrecinctsForCounty(countyName) {
    clearAllPrecinctsOnMap();
    if (!ALLOWED_COUNTIES.includes(ELEMENTS.countyDropdown.value)) return;
    if (!ELEMENTS.precinctCheckbox.checked) return;

    const countyFeature = getCountyFeatureByName(countyName);
    if (!countyFeature) return;

    const precinctColorMap = generatePrecinctColorMap(countyFeature);
    showPrecinctColorsOnMap(precinctColorMap, countyFeature);
    updatePrecinctsInLegend(precinctColorMap);
}

function clearPrecinctsInLegend() {
    ELEMENTS.precinctsLegendDiv.innerHTML = ELEMENTS.precinctCheckbox.checked ?
        'Precinct information currently unavailable for this county' :
        'Enable precinct layer and select county to view precincts';
}

function updatePrecinctsInLegend(precinctColorMap) {
    ELEMENTS.precinctsLegendDiv.innerHTML = '';
    const sortedPrecinctNames = Object.keys(precinctColorMap).sort();

    sortedPrecinctNames.forEach(precinctName => {
        ELEMENTS.precinctsLegendDiv.innerHTML += `
            <div class="legend-item">
                <div class="legend-color" style="background: rgba(${hexToRgb(precinctColorMap[precinctName])}, 0.55);"></div> ${precinctName}
            </div>`;
    });
}

const hexToRgb = hex => parseInt(hex.replace('#', ''), 16).toString(16).match(/.{2}/g).map(n => parseInt(n, 16)).join(', ');

function reverseGeocode(lat, lng) {
    cancelTokenSource && cancelTokenSource.cancel();
    cancelTokenSource = axios.CancelToken.source();

    const reverseGeocodeUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;
    axios.get(reverseGeocodeUrl, {
        cancelToken: cancelTokenSource.token
    })
        .then(response => displayAddress(response.data))
        .catch(error => {
            if (!axios.isCancel(error)) {
                console.error("Error occurred during reverse geocoding:", error);
            }
        });
}

function displayAddress(address) {
    const components = [
        address.address.house_number,
        address.address.road,
        address.address.city || address.address.village || address.address.town,
        address.address.state,
        address.address.postcode,
    ];

    ELEMENTS.addressDisplay.innerHTML = components.filter(Boolean).length > 0
        ? `<span style="color: #666; font-weight: 500;">Approximate address:&nbsp</span>${components.filter(Boolean).join(', ')}`
        : 'Address not found';
}

function setPlaceholderAddress() {
    ELEMENTS.addressDisplay.textContent = 'Fetching address...';
}

function displayCountyAuditorInfo(countyName) {
    const countyAuditor = countyAuditorInfo[countyName];
    if (!countyAuditor) return hideCountyAuditorInfoTable();

    showCountyAuditorInfoTable();
    ELEMENTS.countyAuditorInfoTable.rows[0].cells[1].textContent = countyAuditor.County;
    ELEMENTS.countyAuditorInfoTable.rows[1].cells[1].textContent = countyAuditor.Auditor;
    ELEMENTS.countyAuditorInfoTable.rows[2].cells[1].textContent = countyAuditor['Phone/Fax/Email'];
    ELEMENTS.countyAuditorInfoTable.rows[3].cells[1].textContent = countyAuditor.Address;
}

function showCountyAuditorInfoTable() {
    ELEMENTS.countyAuditorInfoTable.style.display = 'block';
}

function hideCountyAuditorInfoTable() {
    ELEMENTS.countyAuditorInfoTable.style.display = 'none';
}

function highlightPollingLocationForPrecinct(precinct) {
    clearHighlightedPollLocations();
    if (!pollLocMarkerMap[precinct]) return;

    pollLocMarkerMap[precinct].forEach(marker => {
        marker.setIcon(highlightedPolLocIcon);
        highlightedPollLocMarkers.push(marker);
    });
}

function clearHighlightedPollLocations() {
    highlightedPollLocMarkers.forEach(marker => {
        marker.setIcon(notHighlightedPolLocIcon);
    });
    highlightedPollLocMarkers = [];
}

function clearPostOffices() {
    postOfficeIconMarkers.forEach(marker => {
        map.removeLayer(marker)
    })
}

function populatePollingLocations(pollingLocations) {
    pollingLocations.forEach(pollingLoc => {
        const precinctsList = getPrecinctsList(pollingLoc.Precincts_list);
        const pollingLocation = addSymbolMarker(pollingLoc.latitude, pollingLoc.longitude, notHighlightedPolLocIcon);

        bindPopupToPollLocationMarker(pollingLocation, pollingLoc, precinctsList);
        updatePollLocMarkerMap(precinctsList, pollingLocation);
        addMarkerHoverEffect(pollingLocation);

        pollingLocationMarkers.push(pollingLocation);
    });
}

function populatePostOffices(postOffices) {
    const sourceProjection = 'EPSG:3857'; // Web Mercator
    const destProjection = 'EPSG:4326';   // WGS84 (Latitude/Longitude)

    postOffices.forEach(postOffice => {
        if (postOffice.x && postOffice.y) {
            // Convert coordinates from source projection to destination projection
            const [lng, lat] = proj4('EPSG:3857', 'EPSG:4326', [postOffice.x, postOffice.y]);

            // Add the marker to the map
            const postOfficeIconMarker = addSymbolMarker(lat, lng, postOfficeIcon);

            // Bind a popup with the post office address
            postOfficeIconMarker.bindPopup(postOffice.ADDRESS);

            // Store the marker for future reference
            postOfficeIconMarkers.push(postOfficeIconMarker);
        } else {
            console.error("Invalid post office coordinates:", postOffice);
        }
    });
}

function addSymbolMarker(lat, long, icon) {
    return L.marker([lat, long], {
        icon: icon,
    }).addTo(map);
}

function getPrecinctsList(precincts) {
    return String(precincts).split(',').map(precinct => precinct.trim());
}

function bindPopupToPollLocationMarker(marker, pollingLoc, precinctsList) {
    marker.bindPopup(`
        <b>County:</b> ${pollingLoc.County}<br>
        <b>Polling Location:</b> ${pollingLoc.PollingLocation}<br>
        <b>Address:</b> ${pollingLoc.Address}<br>
        <b>City:</b> ${pollingLoc.City}<br>
        <b>Zip Code:</b> ${pollingLoc.ZipCode}<br>
        <b>Polling Hours:</b> ${pollingLoc.PollingHours}<br>
    `);
}

function updatePollLocMarkerMap(precinctsList, marker) {
    precinctsList.forEach(precinct => {
        (pollLocMarkerMap[precinct] = pollLocMarkerMap[precinct] || []).push(marker);
    });
}

function addMarkerHoverEffect(marker) {
    // For desktop devices
    marker.on('mouseover', function() {
        this.openPopup();
    });
    marker.on('mouseout', function() {
        this.closePopup();
    });

    // For mobile devices
    marker.on('touchstart', function() {
        this.openPopup();
    });
    marker.on('touchend', function() {
        this.closePopup();
    });

    // Optional: Prevent the default behavior of touch events to avoid map panning on touch
    marker.on('touchstart', function(e) {
        e.originalEvent.preventDefault();
    });
}

function createDynamicPollingIcon(zoomLevel, iconUrl, scale, minSize) {
    var size = zoomLevel * scale + minSize; // Customize as needed

    var maxSize = 50;
    size = Math.max(minSize, Math.min(size, maxSize));

    return L.icon({
        iconUrl: iconUrl,
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [1, -size / 2],
    });
}

function createLayersLegend() {
    // Make sure the element exists in the DOM before adding content
    if (!ELEMENTS.layersLegend) {
        console.error('layersLegend element not found in DOM.');
        return;
    }

    ELEMENTS.layersLegend.innerHTML = '';

    let legendContent = `
        <div class="info legend">
            <div class="legend-item legislative">
                <i class="legend-line" style="border-top: 3px dashed #000000;"></i> Legislative
            </div>
            <div class="legend-item tribal">
                <i class="legend-line" style="border-top: 3px solid #a3be8c;"></i> Tribal
            </div>
            <div class="legend-item">
                <i class="legend-line" style="border-top: 2px solid #ff7800;"></i> Counties with precinct info
            </div>
            <div class="legend-item">
                <i class="legend-line" style="border-top: 1px solid #000000;"></i> Other Counties
            </div>
        </div>
    `;

    ELEMENTS.layersLegend.innerHTML = legendContent;
}

function createIconLegend() {
    ELEMENTS.iconLegend.innerHTML = '';

    const iconLegendContent = `
        <div class="info icon-legend">
            <div class="legend-item">
                <img src="${ICON_PATHS.POLLING_LOCATION}" class="legend-icon" alt="Polling place"> Polling place
            </div>
            <div class="legend-item">
                <img src="${ICON_PATHS.HIGHLIGHTED_POLLING_LOCATION}" class="legend-icon" alt="Polling place for selected precinct"> Polling place for selected precinct
            </div>
            <div class="legend-item">
                <img src="${ICON_PATHS.POST_OFFICE}" class="legend-icon" alt="Post office"> Post office
            </div>
        </div>`;

    ELEMENTS.iconLegend.innerHTML = iconLegendContent;
}

function loadCountyAuditorInfo(path) {
    Papa.parse(path, {
        download: true,
        header: true,
        complete: (results) => {
            results.data.forEach((row) => {
                countyAuditorInfo[row.County] = row;
            });
            populateCountySelector(results.data);
        },
        error: (error) => {
            console.error("Error loading county auditor info:", error);
        }
    });
}

function initControls() {
    initCountySelector();
    initCheckBoxStates();
}

function initCheckBoxStates() {
    ELEMENTS.precinctCheckbox.checked = true;
    ELEMENTS.countyCheckbox.checked = true;
    ELEMENTS.countyCheckbox.disabled = true;
}

function initCountySelector() {
    ELEMENTS.countyDropdown.addEventListener('change', (e) => {
        clearAllPrecinctsOnMap();
        const selectedCounty = e.target.value;
        if (!selectedCounty) {
            highlightedCountyLayer && map.removeLayer(highlightedCountyLayer);
            hideCountyAuditorInfoTable();
        }
        map.fitBounds(L.geoJson(getCountyFeatureByName(selectedCounty)).getBounds());
        highlightCounty(selectedCounty);
    });
}

function zoomToCoords(latlng, threshold) {
    map.setView(latlng, map.getZoom() < threshold ? threshold : map.getZoom());
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
        Precinct: true,
    });
    initSymbolLayers();
    initControls();
    initLegend();

    loadCountyAuditorInfo(COUNTY_DATASOURCE_PATHS.COUNTY_AUDITOR);
    hideCountyAuditorInfoTable(); // Hide at the start

    // Initialize icons after map creation
    notHighlightedPolLocIcon = createDynamicPollingIcon(map.getZoom(), ICON_PATHS.POLLING_LOCATION, 2, 10);
    highlightedPolLocIcon = createDynamicPollingIcon(map.getZoom(), ICON_PATHS.HIGHLIGHTED_POLLING_LOCATION, 2, 10);
    postOfficeIcon = createDynamicPollingIcon(map.getZoom(), ICON_PATHS.POST_OFFICE, 1, 5);

    setupMapClickHandling();
    setupMapZoomHandling();
}

function setupMapClickHandling() {
    map.on('click', (e) => {
        clearAllPrecinctsOnMap();
        clearHighlightedPollLocations();
        clearHighlightedCounty();
        setPlaceholderAddress();
        clearCurrentMarker();

        const county = getGeographicalFeature(e.latlng.lat, e.latlng.lng, countyData, 'NAME');
        const precinct = getGeographicalFeature(e.latlng.lat, e.latlng.lng, precinctData, 'Name');
        const district = getGeographicalFeature(e.latlng.lat, e.latlng.lng, legislativeData, 'DISTRICT');

        zoomToCoords(e.latlng, 8);
        ELEMENTS.countyDropdown.value = county || "";

        county ? (
            displayCountyAuditorInfo(county),
            placeMarker(e.latlng, precinct, district),
            showPrecinctsForCounty(county)
        ) : hideCountyAuditorInfoTable();

        ALLOWED_COUNTIES.includes(county) && highlightCounty(county);
        highlightPollingLocationForPrecinct(precinct);
        reverseGeocode(e.latlng.lat, e.latlng.lng);
    });
}

function setupMapZoomHandling() {
    map.on('zoomend', () => {
        notHighlightedPolLocIcon = createDynamicPollingIcon(map.getZoom(), ICON_PATHS.POLLING_LOCATION, 2, 10);
        highlightedPolLocIcon = createDynamicPollingIcon(map.getZoom(), ICON_PATHS.HIGHLIGHTED_POLLING_LOCATION, 2, 10);
        postOfficeIcon = createDynamicPollingIcon(map.getZoom(), ICON_PATHS.POST_OFFICE, 1, 5);

        pollingLocationMarkers.forEach(marker => {
            marker.setIcon(notHighlightedPolLocIcon);
        });

        highlightedPollLocMarkers.forEach(marker => {
            marker.setIcon(highlightedPolLocIcon);
        });

        postOfficeIconMarkers.forEach(marker => {
            marker.setIcon(postOfficeIcon);
        });
    });
}

// Start the application
initializeApplication();

