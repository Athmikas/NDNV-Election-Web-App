# North Dakota Native Vote - Data Democracy Project

You can view the map tool here: https://ndnv-electionmap.vercel.app/. It currently includes precinct data mapping precincts to polling locations for the following counties, which are most aligned with NDNV’s fieldwork: **Benson**, **Dunn**, **McKenzie**, **McLean**, **Mercer**, **Mountrail**, **Rolette**, **Sioux**. While, up-to-date polling location, legislative district and county auditor information is available statewide. 

## Data Sources

### Map Boundary Layers

- The map tool uses (OpenStreetMap)[https://www.openstreetmap.org/about] as the base map layer. 
- The  [precinct layer](https://github.com/uchicago-dsi/north_dakota_native_vote/blob/main/data/precinct_boundaries.geojson) showing the precinct boundaries within each county was created by digitizing  PDF precinct maps provided by the North Dakota Secretory of State's office.
- The [tribal reservation](https://services1.arcgis.com/GOcSXpzwBHyk2nog/arcgis/rest/services/NDGISHUB_Reservations/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson), [legislative district](https://github.com/uchicago-dsi/north_dakota_native_vote/blob/main/data/legislative_boundaries_2024.geojson), and [county](https://services1.arcgis.com/GOcSXpzwBHyk2nog/arcgis/rest/services/NDGISHUB_County_Boundaries/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson) boundaries are publically available on the [North Dakota GISHUB](https://www.gis.nd.gov/). 

### Polling Location and County Auditor Data
- The [polling location dataset](https://github.com/uchicago-dsi/north_dakota_native_vote/blob/main/data/polling_locations.csv) was first obtained from the North Dakota Secretory of State website, and then each polling location was geocoded to create a new [geocoded polling location json file](https://github.com/uchicago-dsi/north_dakota_native_vote/blob/main/data/geocoded_polling_locations_with_precincts.json). The polling locations dataset was last downloaded on September 11 2024, and it should reflect the final locations for the November 2024 elections.   
- The [county auditor dataset](https://github.com/uchicago-dsi/north_dakota_native_vote/blob/main/data/County_Auditor_Information.csv) was also obtained from the North Dakota Secretory of State website. 
