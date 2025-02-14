
import { 
    ELEMENTS, 
    ICON_PATHS,
} from '../config/constants.js';

export class LegendManager {
    createLayersLegend() {
        if (!ELEMENTS.layersLegend) {
            console.error('layersLegend element not found in DOM.');
            return;
        }
    
        ELEMENTS.layersLegend.innerHTML = `
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
    }
    
    createIconLegend() {
        ELEMENTS.iconLegend.innerHTML = `
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
            </div>
        `;
    }
}