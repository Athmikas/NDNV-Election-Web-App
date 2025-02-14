
export class GeocodingManager {
    constructor() {
        this.cancelTokenSource = null;
    }
    
    async reverseGeocode(lat, lng) {
        if (this.cancelTokenSource) {
            this.cancelTokenSource.cancel();
        }
        this.cancelTokenSource = axios.CancelToken.source();
    
        try {
            const reverseGeocodeUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;
            const response = await axios.get(reverseGeocodeUrl, { 
                cancelToken: this.cancelTokenSource.token 
            });
            return this.formatAddress(response.data);
        } catch (error) {
            if (!axios.isCancel(error)) {
                console.error("Error during reverse geocoding:", error);
                return null;
            }
        }
    }
    
    formatAddress(addressData) {
        const components = [
            addressData.address.house_number,
            addressData.address.road,
            addressData.address.city || addressData.address.village || addressData.address.town,
            addressData.address.state,
            addressData.address.postcode,
        ];
    
        return components.filter(Boolean).length > 0 
            ? components.filter(Boolean).join(', ')
            : 'Address not found';
    }
    }