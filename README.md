# maphopper
maphopper is a proxy written in node.js to use Graphhopper Directions API responses with the Mapbox SDK.

It modifies the response you get from the Graphhoppper API and returns a fully functional Mapbox API response in JSON format. ([Mapbox Directions API Documentation](https://www.mapbox.com/api-documentation/?language=cURL#directions))

<i>available as a <a href="https://hub.docker.com/r/gadda27/maphopper/">Docker container</a> at "gadda27/maphopper".</i>
## Supported APIs

##### Graphhopper Routing API => Mapbox Directions API

##### Graphhopper Route Optimization API => Mapbox Optimization API

##### Graphhopper Isochrone API => Mapbox Isochrone API

##### Graphhopper Matrix API => Mapbox Matrix API

### Usage

Pull the docker container:
`docker pull gadda27/maphopper`

Run the docker container at your preferred port:
`docker run -p [PORT]:8082 -d gadda27/maphopper`

### Requests
Use the same syntax for requests that you use for [Graphhopper Directions API Requests](https://graphhopper.com/api/1/docs/).

The endpoint is the same: `.../api/[version]/...`

## Routing API

### Parameters
The parameters which are needed to convert to a Mapbox Directions API Response are: min. 2x `point`, `vehicle`, `key`, `points_encoded=false`, and `locale`.

#### Optional:

`algorithm=alternative_route`to get multiple routes in your response. If you choose to do that, make sure you also pass `ch.disable=true`.

`geometries="geojson"` to change the format of the geometry to geojson. The default is polyline6 encoding ([See Mapbox Doc](https://docs.mapbox.com/api/navigation/#retrieve-directions)).

You can pass a Mapbox-Access-Token along your inital request, which will be used in the `RouteOptions` of the response. This can be be helpful if you are using the Mapbox SDK and you want to use other Mapbox services other than navigation. (The Mapbox Navigation SDK also uses this token while navigating when it is rerouting you, unless you change the OffRouteListener.)
The parameter for this is `mapboxkey`. By default it will be left blank.

### Example Request

(proxy deployed locally)

`http://localhost:3000/api/1/route?point=40.72,-74&vehicle=car&locale=en&key=[GH_ACCESSTOKEN]&points_encoded=false&point=40.733,-73.989&mapboxkey=[MB_ACCESS_TOKEN]`

## Route Optimization API

The proxy takes your previously posted problem.json and if the processing at Graphhopper is finished, it will convert it to a Mapbox Optimization Response. 

See the [API Documentation](https://graphhopper.com/api/1/docs/route-optimization/) for details on how to post a problem.json etc.

### Response 

Note that some properties of your initial GH response will be ignored, since a Mapbox Optimization response isn't as detailed.  Among them are `type`, `waiting_time`, and `unassigned`.
Step-by-step instructions in the Mabpbox Response are not supported, as there is no way to include them into your GH response.
### Example Request

To get your solution from Graphhopper via the proxy (deployed locally):

`http://localhost:3000/api/1/vrp/solution/[RETURNED_JOB_ID]?key=[GH_ACCESSTOKEN]`

## Isochrone API

See the [GH Isochrone Doc](https://graphhopper.com/api/1/docs/isochrone/) for information on Isochrone requests.

### Parameters

All official parameters of the GH Isochrone API are supported.
Make sure the `debug` parameter is set to `true` for an optimal conversion.
Along with those parameters, you can pass a `contours_colors` parameter:

#### contours_colors

  `contours_colors`: _The colors to use for each isochrone contour, specified as hex values without a leading  # (for example,  ff0000 for red)._ (See Mapbox [Doc](https://www.mapbox.com/api-documentation/?language=cURL#retrieve-isochrones-around-a-location))
  
  If the mapper can't find a color for the given polygon in your passed array of colors, the default color will be `#ff0000`(red)
  
#### Important: (contours_minutes)
There is no direct way to tell GH in which time intervals you want a polygon to be calculated. You can only pass the number of `buckets`. The contours_minutes property of the Mapbox Response is calculated by the mapper under the assumption that at GH the calculation is proportional.

##### Example:
passed parameters: `time_limit=400`, `buckets=4`
returns polygons with time limits of: 100, 200, 300, 400

### Example Request
`http://localhost:3000/api/1/isochrone?point=51.131108,12.414551&key=[GH_ACCESSKEY]&debug=true&time_limit=600&buckets=4`


## Matrix API

Mapping of the Maprix API is currently supported with simple requests that don't require you to post a problem.json. 

See the [GH Matrix Doc](https://graphhopper.com/api/1/docs/matrix/) for information on Matrix requests.

### Parameters

passing "weights" in the `out_arrays` parameter will be ignored for the conversion, as the Mapbox Matrix API can only return durations and distances matrixes.
All other official parameters are supported. 

### Example Request
`http://localhost:3000/api/1/matrix?type=json&vehicle=car&debug=true&out_array=times&out_array=distances&key=[GH_ACCESSKEY]&from_point=49.932707,11.588051&to_point=50.118817,11.983337&from_point=50.241935,10.747375&to_point=50.118817,11.9834`



