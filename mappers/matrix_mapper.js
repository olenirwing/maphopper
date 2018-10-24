exports.map = function (res, outArray, fromPoints, toPoints, points) {
  points = makePointsArray(points)
  let usedPointsSource = points
  let usedPointsDestinations = points

  if (points.length === 0) {
    usedPointsSource = makePointsArray(fromPoints)
    usedPointsDestinations = makePointsArray(toPoints)
  }
  let sources = getSources(usedPointsSource)
  let destinations = getDestinations(usedPointsDestinations)
  let frame = {
    'code': 'Ok',
    'sources': sources,
    'destinations': destinations
  }
  if (outArray.includes('distances')) {
    frame['distances'] = getDistances(res)
  }
  if (outArray.includes('times')) {
    frame['durations'] = getDurations(res)
  }
  return frame
}

function makePointsArray (points) {
  let base
  if (typeof points === typeof []) {
    base = points
  } else {
    base = [points]
  }
  try {
    let pointsArray = []
    base.map(point => {
      let lon = point.split(',')[0]
      let lat = point.split(',')[1]
      pointsArray.push([lon, lat])
    })
    return pointsArray
  } catch (e) { return [] }
}

function getSources (points) {
  let sources = []
  points.map(point => {
    sources.push(getSingleSource(point))
  })
  return sources
}

function getSingleSource (point) {
  let source = {
    'name': '',
    'location': point
  }
  return source
}

function getDestinations (points) {
  let destinations = []
  points.map(point => {
    destinations.push(getSingleDestination(point))
  })
  return destinations
}

function getSingleDestination (point) {
  let destination = {
    'name': '',
    'location': point
  }
  return destination
}

function getDurations (res) {
  return res.times
}

function getDistances (res) {
  return res.distances
}
