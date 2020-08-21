# swagger-gtfs
Using as the base for an API
Simply download the openapi-gtfs.yaml file!

# Updating the doc
This project contains a script that was used to parse GTFS's models definition by Google into an OpenAPI definition, for use by other APIs.

If the doc becomes outdated (for example, a new version of GTFS becomes available or descriptions are updated), the OpenAPI definition can be updated.

## Known limitations
The enums are added programmatically as empty arrays, so the values must be added by manually

# Acknowledgement
Portions of this document are reproduced from work created and shared by Google and used according to terms described in the Creative Commons 4.0 Attribution License. Original documentation on which this document is based is available at and available at https://developers.google.com/transit/gtfs/reference
