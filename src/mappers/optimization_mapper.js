const polyline = require('@mapbox/polyline')

let allActivities

exports.getMapping = function (response) {
  allActivities = response.solution.routes[0].activities
  let frame = {
    'code': 'Ok',
    'waypoints': getWaypoints(),
    'trips': getTrips(response.solution)
  }
  return frame
}

const getWaypoints = () =>
  allActivities.map((activity, index) => getSingleWaypoint(activity, index))

const getSingleWaypoint = (activity, index) =>
  ({
    'location': getLocation(activity),
    'waypoint_index': index,
    'name': getActivityName(activity),
    'trips_index': 0
  })

function getLocation (activity) {
  let lat = activity.address.lat
  let lon = activity.address.lon
  return [lon, lat]
}

function getActivityName (activity) {
  let name = activity.name !== undefined ? activity.name : activity.location_id
  return name
}

const getTrips = (solution) => [getSingleTrip(solution)]

const getSingleTrip = (solution) => ({
  'distance': solution.distance,
  'duration': solution.transport_time,
  'geometry': getGeometry(solution),
  'legs': getLegs()
})

function getGeometry (solution) {
  let bool = isDetailedGeometry(solution)
  let poly = polyline.encode(getAdaptedCoordinates(solution.routes, bool))
  return poly
}

const isDetailedGeometry = (solution) => (solution.routes[0].points !== undefined)

function getAdaptedCoordinates (routes, detailed = false) {
  let newCoordinates = []
  if (detailed) {
    routes[0].points.map(point => {
      point.coordinates.map(point => {
        let newPoint = [point[1], point[0]]
        newCoordinates.push(newPoint)
      })
    })
  } else {
    newCoordinates = allActivities.map(activity => {
      let pair = getLocation(activity)
      return [pair[1], pair[0]]
    })
  }
  return newCoordinates
}

const getLegs = () => allActivities.filter(activity => activity.type !== 'start').map(activityFiltered => getSingleLeg(activityFiltered))

const getSingleLeg = (activity) => ({
  'summary': getSummary(activity),
  'duration': getActivityDuration(activity),
  'steps': [],
  'distance': getActivityDistance(activity)
})

function getSummary (activity) {
  let nextActivity = getNextActivity(activity)
  let to
  let from = getActivityName(activity)
  try {
    to = getActivityName(nextActivity)
  } catch (e) {
    to = ''
  }
  return from + ' to ' + to
}
function getNextActivity (activity) {
  let index = allActivities.indexOf(activity)
  let nextActivity = null
  try {
    nextActivity = allActivities[index + 1]
  } catch (e) {}

  return nextActivity
}

function getActivityDuration (activity) {
  let prevActivity = getPreviousActivity(activity)

  let duration = activity.arr_time - prevActivity.end_time
  return duration
}

function getPreviousActivity (activity) {
  let index = allActivities.indexOf(activity)
  let prevActivity = null
  try {
    prevActivity = allActivities[index - 1]
  } catch (e) {}

  return prevActivity
}

function getActivityDistance (activity) {
  let prevActivity = getPreviousActivity(activity)
  let distance = activity.distance - prevActivity.distance
  return distance
}
