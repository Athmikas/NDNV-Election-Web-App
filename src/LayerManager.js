import {
    ELEMENTS,
    STYLES,
    BOUNDARY_LAYER_PATHS, ALLOWED_COUNTIES
} from '../config/constants.js';

export class LayerManager {
    constructor(map) {
        this.map = map;
        this.layers = {
            county: null,
            legislative: null,
            tribal: null,
            highlightedCounty: null,
            precinctLayers: [],
        };
        this.data = {
            county: null,
            legislative: null,
            tribal: null,
            precinct: null,
        };
    }

    async initializeLayers(layersToInclude) {
        try {
            if (layersToInclude.County) {
                await this.initializeCountyLayer();
            }
            if (layersToInclude.Legislative) {
                await this.initializeLegislativeLayer();
            }
            if (layersToInclude.Tribal) {
                await this.initializeTribalLayer();
            }
            if (layersToInclude.Precinct) {
                await this.initializePrecinctLayer();
            }
        } catch (error) {
            console.error('Error initializing layers:', error);
        }
    }

    async initializeCountyLayer() {
        try {
            const response = await axios.get(BOUNDARY_LAYER_PATHS.COUNTY);
            this.data.county = response.data;
            this.layers.county = L.geoJson(this.data.county, {
                style: this.getCountyStyle,
                onEachFeature: this.onEachCountyFeature.bind(this),
            }).addTo(this.map);
        } catch (error) {
            console.error('Error loading county layer:', error);
        }
    }

    async initializeLegislativeLayer() {
        try {
            const response = await axios.get(BOUNDARY_LAYER_PATHS.LEGISLATIVE);
            this.data.legislative = response.data;
            this.layers.legislative = L.geoJson(this.data.legislative, {
                style: STYLES.LEGISLATIVE_LAYER
            });
        } catch (error) {
            console.error('Error loading legislative layer:', error);
        }
    }

    async initializeTribalLayer() {
        try {
            const response = await axios.get(BOUNDARY_LAYER_PATHS.TRIBAL);
            this.data.tribal = response.data;
            this.layers.tribal = L.geoJson(this.data.tribal, {
                style: STYLES.TRIBAL_BOUNDARIES,
                onEachFeature: this.addTribalLandLabel.bind(this),
            });
        } catch (error) {
            console.error('Error loading tribal layer:', error);
        }
    }

    async initializePrecinctLayer() {
        try {
            const response = await axios.get(BOUNDARY_LAYER_PATHS.PRECINCT);
            this.data.precinct = response.data;
        } catch (error) {
            console.error('Error loading precinct layer:', error);
        }
    }

    getCountyStyle(feature) {
        return {
            color: ALLOWED_COUNTIES.includes(feature.properties.NAME) ? "#ff7800" : "#000000",
            weight: ALLOWED_COUNTIES.includes(feature.properties.NAME) ? 2 : 0.5,
            opacity: ALLOWED_COUNTIES.includes(feature.properties.NAME) ? 1 : 0.5,
            fillOpacity: 0,
        };
    }

    onEachCountyFeature(feature, layer) {
        layer.on('click', () => {
            ELEMENTS.countyDropdown.value = feature.properties.NAME;
            this.highlightCounty(feature.properties.NAME);
        });
    }

    addTribalLandLabel(feature, layer) {
        const center = layer.getBounds().getCenter();
        if (feature.properties?.NAME) {
            const label = L.divIcon({
                className: 'tribal-land-label',
                html: `<div style="color: #808080; font-size: 8px; text-align: center;">${feature.properties.NAME}</div>`,
                iconSize: [50, 20],
                iconAnchor: [10, 0],
            });
            layer.labelMarker = L.marker(center, { icon: label });
        }
    }

    clearHighlightedCounty() {
        if (this.layers.highlightedCounty) {
            this.map.removeLayer(this.layers.highlightedCounty);
            this.layers.highlightedCounty = null;
        }
    }

    highlightCounty(countyName) {
        this.clearHighlightedCounty();
        if (!ELEMENTS.countyCheckbox.checked) return;

        const selectedCountyFeature = this.getCountyFeatureByName(countyName);
        if (!selectedCountyFeature || !ALLOWED_COUNTIES.includes(countyName)) return;

        this.layers.highlightedCounty = L.geoJson(selectedCountyFeature, {
            style: STYLES.HIGHLIGHTED_COUNTY,
        }).addTo(this.map);
    }

    getCountyFeatureByName(countyName) {
        return this.data.county.features.find(feature => feature.properties.NAME === countyName
        );
    }

    clearAllPrecinctsOnMap() {
        this.layers.precinctLayers.forEach(layer => this.map.removeLayer(layer));
        this.layers.precinctLayers = [];
    }

    showPrecinctsForCounty(countyName) {
        this.clearAllPrecinctsOnMap();
        if (!ALLOWED_COUNTIES.includes(countyName) || !ELEMENTS.precinctCheckbox.checked) return;

        const countyFeature = this.getCountyFeatureByName(countyName);
        if (!countyFeature) return;

        const precinctColorMap = this.generatePrecinctColorMap(countyFeature);
        this.showPrecinctColorsOnMap(precinctColorMap, countyFeature);
        this.updatePrecinctsInLegend(precinctColorMap);
    }

    generatePrecinctColorMap(countyFeature) {
        const colors = [
            '#e6194b', '#ffe119', '#4363d8', '#f58231', '#201923', '#6B3E3E', '#fcff5d',
            '#8ad8e8', '#235b54', '#29bdab', '#3998f5', '#37294f', '#277da7', '#3750db',
            '#f22020', '#991919', '#ffcba5', '#e68f66', '#632819', '#c56133', '#ffc413',
            '#b732cc', '#772b9d', '#f47a22', '#2f2aa0', '#f07cab', '#d30b94', '#edeff3',
            '#c3a5b4', '#946aa2', '#5d4c86', '#96341c'
        ];
        const precinctColorMap = {};
        let colorIndex = 0;

        this.data.precinct.features.forEach(feature => {
            if (feature.properties.County === countyFeature.properties.NAME) {
                const precinctName = feature.properties.Name;
                if (!precinctColorMap[precinctName]) {
                    precinctColorMap[precinctName] = colors[colorIndex % colors.length];
                    colorIndex++;
                }
            }
        });

        return precinctColorMap;
    }

    showPrecinctColorsOnMap(precinctColorMap, countyFeature) {
        this.data.precinct.features.forEach(feature => {
            if (feature.properties.County === countyFeature.properties.NAME) {
                const precinctName = feature.properties.Name;
                const layer = L.geoJson(feature, {
                    style: () => ({
                        color: precinctColorMap[precinctName],
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.3,
                        fillColor: precinctColorMap[precinctName],
                    }),
                }).addTo(this.map);
                this.layers.precinctLayers.push(layer);
            }
        });
    }

    updatePrecinctsInLegend(precinctColorMap) {
        ELEMENTS.precinctsLegendDiv.innerHTML = '';
        const sortedPrecinctNames = Object.keys(precinctColorMap).sort();

        sortedPrecinctNames.forEach(precinctName => {
            ELEMENTS.precinctsLegendDiv.innerHTML += `
                <div class="legend-item">
                    <div class="legend-color" style="background: rgba(${this.hexToRgb(precinctColorMap[precinctName])}, 0.55);"></div> ${precinctName}
                </div>`;
        });
    }

    hexToRgb(hex) {
        return parseInt(hex.replace('#', ''), 16).toString(16)
            .match(/.{2}/g)
            .map(n => parseInt(n, 16))
            .join(', ');
    }
}
