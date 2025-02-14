// constants.js
export const ELEMENTS = {
    addressDisplay: document.getElementById('address-display'),
    countyAuditorInfoTable: document.getElementById('county-info-table'),
    precinctsLegendDiv: document.getElementById('legend-items'),
    layersLegend: document.getElementById('layers-legend'),
    iconLegend: document.getElementById('icon-legend'),
    precinctCheckbox: document.getElementById('toggle-precincts'),
    countyCheckbox: document.getElementById('toggle-county'),
    countyDropdown: document.getElementById('county-select'),
    legislativeCheckBox: document.getElementById('county-legislative'),
    postOfficesCheckBox: document.getElementById('toggle-post-offices')
};

export const BOUNDARY_LAYER_PATHS = {
    TRIBAL: 'https://services1.arcgis.com/GOcSXpzwBHyk2nog/arcgis/rest/services/NDGISHUB_Reservations/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson',
    COUNTY: 'https://services1.arcgis.com/GOcSXpzwBHyk2nog/arcgis/rest/services/NDGISHUB_County_Boundaries/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson',
    LEGISLATIVE: 'data/legislative_boundaries_2024.geojson',
    PRECINCT: 'data/precinct_boundaries.geojson',
};

export const SYMBOL_LAYER_PATHS = {
    POLLING_LOCATIONS: 'data/geocoded_polling_locations_with_precincts.json',
    POST_OFFICES: 'data/USPS_Facilities.json'
};

export const COUNTY_DATASOURCE_PATHS = {
    COUNTY_AUDITOR: 'data/County_Auditor_Information.csv',
};

export const ICON_PATHS = {
    POLLING_LOCATION: 'images/voting-pin_notselected.png',
    HIGHLIGHTED_POLLING_LOCATION: 'images/voting-pin_selected.png',
    POST_OFFICE: 'images/po.png'
};

export const ALLOWED_COUNTIES = ['Dunn', 'McKenzie', 'McLean', 'Mountrail', 'Benson', 'Sioux', 'Rolette', 'Mercer'];

export const STYLES = {
    LEGISLATIVE_LAYER: {
        color: "#000000",
        weight: 3,
        opacity: 1,
        dashArray: '4, 10',
        fillOpacity: 0,
    },
    TRIBAL_BOUNDARIES: {
        color: "#a3be8c",
        weight: 3,
        opacity: 1,
        fillOpacity: 0.1,
    },
    HIGHLIGHTED_COUNTY: {
        color: "#ff0000",
        weight: 5,
        opacity: 1,
        fillOpacity: 0.05,
        fillColor: '#ff0000',
    },
};

export const BASE_LAYERS = {
    "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 20,
    }),
};

export const PRECINCT_COLORS = [
    '#e6194b', '#ffe119', '#4363d8', '#f58231', '#201923', '#6B3E3E', '#fcff5d',
    '#8ad8e8', '#235b54', '#29bdab', '#3998f5', '#37294f', '#277da7', '#3750db',
    '#f22020', '#991919', '#ffcba5', '#e68f66', '#632819', '#c56133', '#ffc413',
    '#b732cc', '#772b9d', '#f47a22', '#2f2aa0', '#f07cab', '#d30b94', '#edeff3',
    '#c3a5b4', '#946aa2', '#5d4c86', '#96341c'
];