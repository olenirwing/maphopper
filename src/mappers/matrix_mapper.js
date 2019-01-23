exports.getMapping = function (res, outArray, fromPoints, toPoints, points) {
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
  let base = (typeof points === typeof []) ? points : [points]
  try {
    let pointsArray = base.map(point => {
      let lon = point.split(',')[0]
      let lat = point.split(',')[1]
      return [lon, lat]
    })
    return pointsArray
  } catch (e) { return [] }
}

const getSources = points => points.map(point => getSingleSource(point))

const getSingleSource = point => ({
  'name': '',
  'location': point
})

const getDestinations = points => points.map(point => getSingleDestination(point))

const getSingleDestination = point => ({
  'name': '',
  'location': point
})

const getDurations = res => res.times
const getDistances = res => res.distances
