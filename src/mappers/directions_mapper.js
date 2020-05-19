var polyline = require('@mapbox/polyline')

Array.range = (start, end) =>
  Array.from({ length: end - start }, (v, k) => k + start)

var allInstructions
var allCoordinates
var allCoordinatesGEO
var locale
var profile
var geometries

let departAnnouncementAlreadySaid = false

const UUID = generateUuid()

const FAR = 2000
const MID = 1000
const CLOSE = 400
const VERY_CLOSE = 200
const EXTREMELY_CLOSE = 60
const DISTANCE_TYPES_METRIC = [FAR, MID, CLOSE, VERY_CLOSE, EXTREMELY_CLOSE]

const FAR_IMPERIAL = 1609.34; // mile
const MID_IMPERIAL = 804.67; // half-mile
const CLOSE_IMPERIAL = 304.7999; // 1,000 feet
const VERY_CLOSE_IMPERIAL = 152.3999; // 500 feet
const EXTREMELY_CLOSE_IMPERIAL = 60.9599; // 200 feet
const DISTANCE_TYPES_IMPERIAL = [
  FAR_IMPERIAL,
  MID_IMPERIAL,
  CLOSE_IMPERIAL,
  VERY_CLOSE_IMPERIAL,
  EXTREMELY_CLOSE_IMPERIAL,
];

const DISTANCE_TYPES = {metric: DISTANCE_TYPES_METRIC, imperial: DISTANCE_TYPES_IMPERIAL}

exports.getMapping = function (
  jsonRes,
  _profile,
  _locale,
  mapboxKey,
  _geometries
) {
  var paths = jsonRes.paths
  locale = _locale !== undefined ? _locale : 'en'
  profile = _profile !== undefined ? _profile : 'car'
  geometries = _geometries === 'geojson' ? 'geojson' : 'polyline6'
  var mapBoxResponse = {
    routes: getAllMapboxRoutes(paths, mapboxKey),
    waypoints: getWaypoints(paths),
    code: 'Ok',
    uuid: UUID
  }
  return mapBoxResponse
}

function getWaypoints (paths) {
  let coordinates = paths[0].snapped_waypoints.coordinates
  let firstStreet = getFirstStreetName()
  let lastStreet = getLastStreetName()
  let waypoints = coordinates.map((coordinatePair, index) => ({
    name: index === 0 ? firstStreet : lastStreet,
    location: coordinatePair
  }))
  return waypoints
}

function getAllMapboxRoutes (paths, mapboxKey) {
  var routes = paths.map(path => getSingleMapboxRoute(path, mapboxKey))
  return routes
}

function getSingleMapboxRoute (path, mapboxKey) {
  allInstructions = path.instructions
  allCoordinatesGEO = path.points.coordinates // coordinates in GEOJSON format (longitude, latitude)
  allCoordinates = getAdaptedCoordinates(path.points.coordinates) // (latitude,longitude)
  var mapBoxRoute = {
    distance: path.distance,
    duration: path.time / 1000,
    geometry:
      geometries === 'polyline6'
        ? polyline.encode(allCoordinates)
        : {
          coordinates: allCoordinatesGEO,
          type: 'LineString'
        }, // polyline.encode(allCoordinates),
    weight: path.time / 1000,
    weight_name: 'routability',
    legs: getLegs(path),
    routeOptions: getRouteOptions(path, mapboxKey),
    voiceLocale: locale
  }
  return mapBoxRoute
}

function getLegs (path) {
  let legs = [
    {
      distance: path.distance,
      duration: path.time / 1000,
      summary: getSummary(),
      steps: getSteps()
    }
  ]
  return legs
}

function getSummary () {
  let firstStreet = getFirstStreetName()
  let lastStreet = getLastStreetName()
  var summary = 'GraphHopper Route: ' + firstStreet + ' to ' + lastStreet
  return summary
}

function getFirstStreetName () {
  var firstStreet = allInstructions[0].street_name
  return firstStreet
}

function getLastStreetName () {
  let index = allInstructions.length > 1 ? allInstructions.length - 2 : 1
  let streetName = allInstructions[index].street_name
  return streetName
}

function getAdaptedCoordinates (coords) {
  var index
  var len
  var newCoordinates = []
  for (index = 0, len = coords.length; index < len; ++index) {
    var pair = coords[index]
    var x = pair[1] * 10 // * 10 as a fix to use Polyline Encoding with precision 6, otherwise coordinates are off NOTE: this is only for the encoded geometry strings
    var y = pair[0] * 10
    newCoordinates[index] = [x, y]
  }
  return newCoordinates
}

function getMapboxModifier (sign) {
  var modifier = 'straight'
  switch (sign) {
    case -3:
      modifier = 'sharp left'
      break
    case -2:
      modifier = 'left'
      break
    case -1:
      modifier = 'slight left'
      break
    case 1:
      modifier = 'slight right'
      break
    case 2:
      modifier = 'right'
      break
    case 3:
      modifier = 'sharp right'
      break
    case 6:
      modifier = 'right'
      break
    case 7:
      modifier = 'right'
      break
  }
  return modifier
}

const isFirstInstruction = instruction =>
  getPreviousInstruction(instruction, allInstructions) === null
const isLastInstruction = instruction =>
  getNextInstruction(instruction, allInstructions) === null

function getSteps () {
  let steps = allInstructions.map(instruction => {
    let allPointIndexes = Array.range(
      instruction.interval[0],
      instruction.interval[1] + 1
    )
    let sectionPoints = allPointIndexes.map(index => allCoordinates[index])
    let sectionPointsGEO = allPointIndexes.map(index => allCoordinatesGEO[index])
    return {
      name: isLastInstruction(instruction)
        ? getLastStreetName()
        : instruction.street_name,
      duration: instruction.time / 1000,
      weight: instruction.time / 1000,
      distance: instruction.distance,
      geometry: geometries === 'polyline6' ? polyline.encode(sectionPoints) : {
        coordinates: sectionPointsGEO,
        type: 'LineString'
      },
      driving_side: getDrivingSide(),
      mode: convertProfile(),
      maneuver: getManeuver(instruction),
      intersections: getIntersections(instruction),
      voiceInstructions: getVoiceInstructions(instruction),
      bannerInstructions: getBannerInstructions(instruction)
    }
  })
  return steps
}

function getIntersections (instruction) {
  let rangeStart = instruction.interval[0] + 1
  let rangeEnd = instruction.interval[1]
  let intersections = hasIntersections(instruction)
    ? Array.range(rangeStart, rangeEnd).map(index => {
      let coordinate = allCoordinatesGEO[index]
      let nextCoordinate = allCoordinatesGEO[index + 1]
      return getSingleIntersection(coordinate, nextCoordinate)
    })
    : [createDummyIntersection(instruction)]

  return intersections
}

function getSingleIntersection (coordinate, nextCoordinate) {
  return {
    out: 0,
    entry: [true],
    bearings: [
      calculateBearing(
        coordinate[1],
        coordinate[0],
        nextCoordinate[1],
        nextCoordinate[0]
      )
    ],
    location: coordinate
  }
}

function hasIntersections (instruction) {
  let numberOfInstructions =
    instruction.interval[1] - instruction.interval[0] - 1
  return numberOfInstructions > 0
}

function createDummyIntersection (instruction) {
  let bearing = getBearingBefore(instruction)

  if (isLastInstruction(instruction)) {
    bearing = bearing - 180 // acc. to mapbox doc., substracting 180 gives the direction of driving
  }
  let intersection = {
    location: allCoordinatesGEO[instruction.interval[1]],
    out: 0,
    entry: [true],
    bearings: [bearing]
  }
  return intersection
}

function getDrivingSide () {
  // this function should be used with a country determinator, as locale is only for language settings
  // so not yet supported
  let leftSideCountries = ['en-gb', 'en-au', 'mt']
  return leftSideCountries.includes(locale.toLowerCase()) ? 'left' : 'right'
}

function getManeuver (instruction) {
  var modifier
  let type = getType(instruction)
  switch (type) {
    case 'arrive':
      modifier =
        instruction.last_heading !== undefined
          ? getDirectionOfHeading(instruction.last_heading)
          : getMapboxModifier(instruction.sign)
      break
    default:
      modifier = getMapboxModifier(instruction.sign)
      break
  }
  return {
    bearing_before: getBearingBefore(instruction),
    bearing_after: getBearingAfter(instruction),
    location: allCoordinatesGEO[instruction.interval[0]],
    modifier: modifier,
    type: type,
    instruction: instruction.text,
    exit: type === 'roundabout' ? instruction.exit_number : undefined
  }
}

function getDirectionOfHeading (angle) {
  // assumes that the 'last_heading' property has sth to do with on which side the target is
  if (angle >= 180) {
    return 'left'
  } else {
    return 'right'
  }
}

function getType (instruction) {
  if (instruction === null) {
    return 'arrive'
  }
  if (isFirstInstruction(instruction)) {
    return 'depart'
  } else {
    switch (instruction.sign) {
      case 4: // FINISH
      case 5: // REACHED_VIA
        return 'arrive'
      case 6: // USE_ROUNDABOUT
        return 'roundabout'
      case -7:
      case 7:
        return 'continue'
      default:
        return 'turn'
    }
  }
}

function getPreviousInstruction (instruction) {
  let index = allInstructions.indexOf(instruction)
  return index !== 0 ? allInstructions[index - 1] : null
}

function getNextInstruction (instruction) {
  var index = allInstructions.indexOf(instruction)
  return index !== allInstructions.length - 1
    ? allInstructions[index + 1]
    : null
}

function metricOrImperial(locale) {
  switch(locale.toLowerCase) {
    case "en-us": // United States
      return "imperial"
    case "my_mm": // Myanmar
      return "imperial"
    case "en_lr": // Liberia
      return "imperial"
    default:
      return "metric"
  }
}

function getVoiceInstructions (instruction) {
  var voiceInstructions = []
  if (isLastInstruction(instruction)) {
    return voiceInstructions
  }
  var distanceToNextSection = Math.floor(instruction.distance / 10) * 10
  departAnnouncementAlreadySaid = false
  if (isFirstInstruction(instruction)) {
    voiceInstructions.push(
      getSingleVoiceInstruction(distanceToNextSection, instruction, false)
    )
  }
  DISTANCE_TYPES[metricOrImperial(locale)].map(distanceType => {
    switch (distanceType) {
      case EXTREMELY_CLOSE:
        if (distanceToNextSection < EXTREMELY_CLOSE) {
          // the voice shouldnt say the distance left if the distance is < EXTREMELY_CLOSE
          voiceInstructions.push(
            getSingleVoiceInstruction(
              distanceToNextSection,
              instruction,
              isLastInstruction(getNextInstruction(instruction))
            )
          )
        } else {
          voiceInstructions.push(
            getSingleVoiceInstruction(
              EXTREMELY_CLOSE,
              instruction,
              isLastInstruction(getNextInstruction(instruction))
            )
          ) //  60m before turn final announcement is made
        }
        break
      default:
        if (distanceToNextSection > distanceType) {
          voiceInstructions.push(
            getSingleVoiceInstruction(distanceType, instruction)
          )
        }
    }
  })
  return voiceInstructions
}

function getSingleVoiceInstruction (
  distanceAlongGeometry,
  instruction,
  sayDistance = true
) {
  // Voice Instructions use the text of the next Manuever, so from the next instruction
  // For the very beginning of the navigation however, you need the text of the current instruction
  let spokenInstruction = getNextInstruction(instruction)
  let nextInstruction = getNextInstruction(spokenInstruction)
  let departAnnouncement = '' // the very first announcement, often "follow route"
  let announcement = ''
  if (isFirstInstruction(instruction) && !departAnnouncementAlreadySaid) {
    departAnnouncement = instruction.text + getTranslatedSentenceConnector()
    departAnnouncementAlreadySaid = true
  }
  if (spokenInstruction !== null) {
    announcement = spokenInstruction.text
  }

  if (
    !sayDistance &&
    shouldAddNextVoiceInstruction(spokenInstruction, nextInstruction)
  ) {
    announcement += getTranslatedSentenceConnector() + nextInstruction.text
  }
  var voiceInstruction = {
    distanceAlongGeometry: distanceAlongGeometry,
    announcement: departAnnouncement + announcement,
    ssmlAnnouncement: getSsmlAnnouncement(
      distanceAlongGeometry,
      announcement,
      sayDistance,
      departAnnouncement
    )
  }
  return voiceInstruction
}

function getSsmlAnnouncement (
  distanceAlongGeometry,
  announcement,
  sayDistance,
  departAnnouncement
) {
  const distanceString = sayDistance
    ? getTranslatedDistance(distanceAlongGeometry)
    : ''
  const ssml =
    '<speak><amazon:effect name="drc"><prosody rate="1.08">' +
    departAnnouncement +
    distanceString +
    announcement +
    ' </prosody></amazon:effect></speak>'
  return ssml
}

const shouldAddNextVoiceInstruction = (instruction, nextInstruction) =>
  nextInstructionExists(instruction) &&
  isStepShort(nextInstruction) &&
  !isLastInstruction(nextInstruction)

const nextInstructionExists = instruction =>
  getNextInstruction(instruction) !== null

const isStepShort = instruction =>
  instruction !== null && instruction.distance < EXTREMELY_CLOSE

function getBannerInstructions (instruction) {
  if (isLastInstruction(instruction)) {
    return []
  }

  const nextInstruction = getNextInstruction(instruction)
  const distanceAlongGeometry = nextInstructionExists(instruction)
    ? instruction.distance
    : 0
  var modifier = nextInstructionExists(instruction)
    ? getMapboxModifier(nextInstruction.sign)
    : ''

  var text
  var componentsText
  if (nextInstruction && nextInstruction.streetName === '') {
    componentsText = nextInstruction.text
    text = nextInstruction.text // Target reached is in 'text' key, not street_name
  } else if (nextInstruction && nextInstruction.streetName !== '') {
    componentsText = nextInstruction.street_name
    text = nextInstruction.street_name
  } else {
    text = instruction.text
    modifier = ''
    componentsText = instruction.text
  }
  var bannerInstruction = {
    distanceAlongGeometry: distanceAlongGeometry,
    primary: {
      text: text,
      type: getType(nextInstruction),
      modifier: modifier,
      components: [{ text: componentsText, type: 'text' }],
      secondary: null
    }
  }
  if (getType(nextInstruction) === 'roundabout') {
    bannerInstruction = addRoundaboutProperties(
      bannerInstruction,
      nextInstruction
    )
  }
  if (
    nextInstructionExists(nextInstruction) &&
    isStepShort(getNextInstruction(nextInstruction))
  ) {
    // adds a sub banner if the next step is really short
    var sub = getSubBanner(nextInstruction)
    bannerInstruction['sub'] = sub
  }
  return [bannerInstruction]
}

function addRoundaboutProperties (bannerInstruction, usedInstruction) {
  let turnAngle = usedInstruction.turn_angle
  let degrees = convertRadianToDegree(turnAngle)
  bannerInstruction.primary['degrees'] = degrees
  bannerInstruction.primary['driving_side'] = getDrivingSide()
  return bannerInstruction
}

function convertRadianToDegree (turnAngle) {
  let degrees = turnAngle * (180 / Math.PI)
  return Math.round(Math.abs(degrees))
}

function getSubBanner (primaryInstruction) {
  // primaryInstruction = instruction used for primary banner
  // not working as of yet, sub info gets ignored
  var instructionAfter = getNextInstruction(primaryInstruction)
  var sub = {
    text: instructionAfter.street_name,
    type: getType(primaryInstruction),
    modifier: getMapboxModifier(instructionAfter.sign),
    components: [{ text: instructionAfter.street_name, type: 'text' }]
  }
  return sub
}

function convertProfile () {
  var mProfile
  // var driving = ["car", "small_truck", "truck", "scooter"]
  var cycling = ['bike', 'mtb', 'racingbike']
  var walking = ['foot', 'hike']
  if (walking.includes(profile)) {
    mProfile = 'walking'
  } else if (cycling.includes(profile)) {
    mProfile = 'cycling'
  } else {
    mProfile = 'driving'
  }
  return mProfile
}

function getBearingBefore (instruction) {
  if (isFirstInstruction(instruction)) {
    return 0
  }
  if (isLastInstruction(instruction)) {
    let bearing = getLastBearingOfPreviousInstruction(instruction)
    return bearing
  } else {
    var bearingBfP1 = allCoordinatesGEO[instruction.interval[0]]
    var bearingBfP2 = allCoordinatesGEO[instruction.interval[1]]
    if (hasIntersections(instruction)) {
      // this results in a more accurate bearing, as the intersection is closer to the maneuever
      bearingBfP1 = allCoordinatesGEO[instruction.interval[1] - 1] // the last intersection before the Manuever
    }
    var bearingBf = calculateBearing(
      bearingBfP1[0],
      bearingBfP1[1],
      bearingBfP2[0],
      bearingBfP2[1]
    )
    return bearingBf
  }
}

function getBearingAfter (nextInstruction) {
  var bearingAfP1 = allCoordinatesGEO[nextInstruction.interval[0]]
  var bearingAfP2 = allCoordinatesGEO[nextInstruction.interval[1]] // is either the first intersection or just the next maneuver
  if (hasIntersections(nextInstruction)) {
    bearingAfP2 = allCoordinatesGEO[nextInstruction.interval[0] + 1]
  }
  var bearingAf = calculateBearing(
    bearingAfP1[1],
    bearingAfP1[0],
    bearingAfP2[1],
    bearingAfP2[0]
  )
  return bearingAf
}

function getLastBearingOfPreviousInstruction (instruction) {
  let prevInstruction = getPreviousInstruction(instruction)
  if (hasIntersections(prevInstruction)) {
    let intersections = getIntersections(prevInstruction)
    let lastInter = intersections.slice(-1)[0]
    let bearing = lastInter.bearings[0]
    return bearing
  } else {
    let bearing = getBearingAfter(prevInstruction)
    return bearing
  }
}

function generateUuid () {
  var id = ''
  var possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (var i = 0; i < 25; i++) {
    id += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return id
}

function metersToRoundedMiles(meters) {
  return Math.round(meters / 1609.34 * 10) / 10
}

function metersToRoundedFeet(meters) {
  return Math.round(meters * 3.28084)
}

function getTranslatedDistance (distance) {
  let kilometres = { de: 'Kilometern', en: 'kilometres' }
  let metres = { de: 'Metern', en: 'metres' }
  var unit = 'Metern' // default
  let convertedDistance
  if (metricOrImperial(locale) == "metric") {
    if (distance / 1000 >= 1) {
      unit = kilometres[locale]
      convertedDistance = distance / 1000
    } else {
      convertedDistance = distance
      unit = metres[locale]
    }
  } else {
    if (distance / 800 >= 1) {
      unit = 'mile'
      convertedDistance = metersToRoundedMiles(distance)
    } else {
      unit = 'feet'
      convertedDistance = metersToRoundedFeet(distance)
    }
  }
  let output = 'In ' + convertedDistance + unit + ' '
  return output
}

function getTranslatedSentenceConnector () {
  switch (locale) {
    case 'de':
      return ', dann '
    case 'en':
    case 'en-us':
      return ', then '
  }
}

function getRouteOptions (path, accessKey) {
  let token = accessKey !== undefined ? accessKey : ''
  var routeOptions = {
    baseUrl: 'https://api.mapbox.com',
    user: 'mapbox',
    profile: convertProfile(),
    coordinates: path.snapped_waypoints.coordinates,
    language: locale,
    bearings: ';',
    continueStraight: true,
    roundaboutExits: true,
    geometries: geometries,
    overview: 'full',
    steps: true,
    annotations: '',
    voiceInstructions: true,
    bannerInstructions: true,
    voiceUnits: getUnitSystem(),
    accessToken: token,
    requestUuid: UUID
  }
  return routeOptions
}

function getUnitSystem () {
  let system
  switch (locale) {
    case 'en':
    case 'en-us':
      system = 'imperial'
      break
    default:
      system = 'metric'
  }
  return system
}

function toRadians (degrees) {
  return (degrees * Math.PI) / 180
}

function toDegrees (radians) {
  return (radians * 180) / Math.PI
}

function calculateBearing (startLat, startLng, destLat, destLng) {
  const startLatRad = toRadians(startLat)
  const startLngRad = toRadians(startLng)
  const destLatRad = toRadians(destLat)
  const destLngRad = toRadians(destLng)

  const y = Math.sin(destLngRad - startLngRad) * Math.cos(destLatRad)
  const x =
    Math.cos(startLatRad) * Math.sin(destLatRad) -
    Math.sin(startLatRad) *
      Math.cos(destLatRad) *
      Math.cos(destLngRad - startLngRad)
  let brng = Math.atan2(y, x)
  brng = toDegrees(brng)
  return (brng + 360) % 360 | 0
}
