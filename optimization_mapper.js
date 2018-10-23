//
//
//
//
// {
//     "code": "Ok",
//     "waypoints": [
//         {
//             "location": [ -6.80897, 62.000075 ],
//             "waypoint_index": 0,
//             "name": "Kirkjubøarvegur",
//             "trips_index": 0
//         },
//         {
//             "location": [ -6.802374, 62.004142 ],
//             "waypoint_index": 1,
//             "name": "Marknagilsvegur",
//             "trips_index": 0
//         }
//     ],
//     "trips": [
//         {
//             "distance": 1660.8,
//             "duration": 153,
//             "legs": [
//                 {
//                     "summary": "",
//                     "duration": 77.3,
//                     "steps": [],
//                     "distance": 830.4
//                 },
//                 {
//                     "distance": 830.4,
//                     "steps": [],
//                     "duration": 75.7,
//                     "summary": ""
//                 }
//             ],
//             "geometry": "oklyJ`{ph@yBuY_F{^_FxJoBrBs@d@mATlAUr@e@nBsB~EyJ~Ez^xBtY"
//         }
//     ]
// }
//
//
// {
//   "type": "service",
//   "id": "munich",
//   "location_id": "munich",
//   "address": {
//     "location_id": "munich",
//     "name": "Meindlstraße 11c",
//     "lat": 48.145,
//     "lon": 11.57
//   },
//   "arr_time": 17985,
//   "end_time": 17985,
//   "waiting_time": 0,
//   "distance": 587746,
//   "driving_time": 17985,
//   "load_before": [
//     0
//   ],
//   "load_after": [
//     0
//   ]
// },
const polyline = require('@mapbox/polyline')

let allActivities

exports.map = function (response) {
  allActivities = response.solution.routes[0].activities
  let frame = {
    'code': 'Ok',
    'waypoints': getWaypoints(),
    'trips': getTrips(response.solution)
  }
  return frame
}

function getWaypoints () {
  let index = 0
  allActivities.map(activity => {
    getSingleWaypoint(activity, index)
    index++
  })
}

function getSingleWaypoint (activity, index) {
  let wp = {
    'location': getLocation(activity),
    'waypoint_index': index,
    'name': getActivityName(activity),
    'trips_index': 0
  }
  return wp
}

function getLocation (activity) {
  let lat = activity.address.lat
  let lon = activity.address.lon
  return [lon, lat]
}

function getActivityName (activity) {
  let name
  try {
    if (activity.name !== undefined) {
      name = activity.name
    } else {
      name = activity.location_id
    }
  } catch (e) {
    name = ''
  }

  return name
}

function getTrips (solution) {
  let trips = []
  trips.push(getSingleTrip(solution))
  return trips
}

function getSingleTrip (solution) {
  let trip = {
    'distance': solution.distance,
    'duration': solution.time / 1000,
    'geometry': getGeometry(solution),
    'legs': getLegs()
  }
  return trip
}

function getGeometry (solution) {
  let bool = isDetailedGeometry(solution)
  console.log(bool)
  let poly = polyline.encode(getAdaptedCoordinates(solution.routes, bool))
  return poly
}

function isDetailedGeometry (solution) {
  if (solution.routes[0].points !== undefined) {
    return true
  } else { return false }
}

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
    allActivities.map(activity => {
      let pair
      let newPair
      activity.points.map(point => {
        pair = getLocation(activity)
        newPair = [pair[1], pair[0]]

        // let newPair = [pair[1] * 10, pair[0] * 10]
        newCoordinates.push(newPair)
      })
    })
  }
  return newCoordinates
}

function getLegs () {
  let legs = []
  allActivities.map(activity => {
    if (activity.type === 'start') {
    } else {
      legs.push(getSingleLeg(activity))
    }
  })
  return legs
}

function getSingleLeg (activity) {
  let leg = {
    'summary': getSummary(),
    'duration': getActivityDuration(activity),
    'steps': [],
    'distance': getActivityDistance(activity)
  }
  return leg
}

function getSummary (activity) {
  let nextActivity = getNextActivity(activity)
  let from = getActivityName(activity)
  let to = getActivityName(nextActivity)
  return ''
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
