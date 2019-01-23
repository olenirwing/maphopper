
let amountOfBuckets
let totalTime
let contoursColors

exports.getMapping = function (response, time, buckets, colors) {
  amountOfBuckets = buckets
  totalTime = time
  contoursColors = colors !== undefined ? colors.split(',') : []
  let polygons = response.polygons
  let mapboxIsoRes = {
    'features': getFeatures(polygons),
    'type': 'FeatureCollection'
  }
  return mapboxIsoRes
}

function getFeatures (polygons, colors) {
  let features = polygons.map(polygon => createFeature(polygon))
  return features
}

function createFeature (polygon) {
  let color = getContourColor(polygon)
  let feature = {
    'properties': {
      'contour': getContourMinutes(polygon),
      'color': color,
      'opacity': 0.33,
      'fill': color,
      'fill-opacity': 0.33,
      'fillColor': color,
      'fillOpacity': 0.33
    },
    'type': 'Feature',
    'geometry': {
      'coordinates': getCoordinates(polygon),
      'type': 'Polygon'
    }
  }
  return feature
}

function getContourColor (polygon) {
  let bucket = polygon.properties.bucket
  let color
  try {
    color = contoursColors[bucket]
  } catch (e) {
    color = '#ff0000'
  }
  color = '#' + color
  return color
}

function getContourMinutes (polygon) {
  let bucket = polygon.properties.bucket
  let fraction = (bucket + 1) / (amountOfBuckets)
  let time = fraction * totalTime
  let minutes = Math.round(time / 60)

  return minutes
}

function getCoordinates (polygon) {
  let coordinates = polygon.geometry.coordinates
  return coordinates
}
