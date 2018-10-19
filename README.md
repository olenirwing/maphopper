# maphopper
maphopper is a proxy written in node.js to use Graphhopper Directions API responses with the Mapbox SDK.

It modifies the response you get from the Graphhoppper API and returns a fully functional Mapbox Directions API response in JSON format. ([Mapbox Directions API Documentation](https://www.mapbox.com/api-documentation/?language=cURL#directions))

<i>available as a <a href="https://hub.docker.com/r/gadda27/maphopper/">Docker container</a> at "gadda27/maphopper".</i>


## Usage

Pull the docker container:
`docker pull gadda27/maphopper`

Run the docker container at your preferred port:
`docker run -p 3000:[PORT] -d gadda27/maphopper`

## Requests
Use the same syntax for requests that you use for [Graphhopper Routing API Requests](https://graphhopper.com/api/1/docs/routing/#routing-api).

The endpoint is the same: `.../api/[version]/route`
### Parameters
The parameters which are needed to convert to a Mapbox Response are: min. 2x `point`, `vehicle`, `key`, `points_encoded=false`, and `locale`.
Optionally, you can pass `algorithm=alternative_route`to get multiple routes in your response. If you choose to do that, make sure you also pass `ch.disable=true`.

You can pass a Mapbox-Access-Token along your inital request, which will be used in the `RouteOptions` of the response. This can be be helpful if you are using the Mapbox SDK and you want to use other Mapbox services other than navigation. (The Mapbox Navigation SDK also uses this token while navigating when it is rerouting you, unless you change the OffRouteListener.)
The parameter for this is `mapboxkey`. By default it will be left blank.

### Example Request:

`http://localhost:3000/api/1/route?point=40.72,-74&vehicle=car&locale=en&key=[GH_KEY]&points_encoded=false&point=40.733,-73.989&mapboxkey=[MB_KEY]`
