var polyline = require('@mapbox/polyline')
var bearingCalc = require('./bearingCalc')

var allInstructions
var allCoordinates
var allCoordinatesGEO
var locale

const UUID = generateUuid()

const FAR = 2000
const MID = 1000
const CLOSE = 400
const VERY_CLOSE = 200
const EXTREMELY_CLOSE = 60

let departAnnouncementAlreadySaid = false

exports.map = function (jsonRes, profile, _locale, mapboxKey) {
  console.log('#####################')
  var paths = jsonRes.paths
  locale = _locale
  var mapBoxResponse = {
    'routes': getAllMapboxRoutes(paths, profile, mapboxKey),
    'waypoints': getWaypoints(paths),
    'code': 'Ok',
    'uuid': UUID
  }
  return mapBoxResponse
}

function getWaypoints (paths) {
  let waypoints = []
  let coordinates = paths[0].snapped_waypoints.coordinates
  let firstStreet = getFirstStreetName()
  let lastStreet = getLastStreetName()
  let index = 0
  coordinates.map(coordinatePair => {
    let street
    if (index === 0) {
      street = firstStreet
    } else {
      street = lastStreet
    }
    let waypoint = {
      'name': street,
      'location': coordinatePair
    }
    index++
    waypoints.push(waypoint)
  })
  return waypoints
}

function getAllMapboxRoutes (paths, profile, mapboxKey) {
  var routes = paths.map(path => getSingleMapboxRoute(path, profile, mapboxKey))
  return routes
}

function getSingleMapboxRoute (path, profile, mapboxKey) {
  allInstructions = path.instructions
  allCoordinatesGEO = path.points.coordinates // coordinates in GEOJSON format
  allCoordinates = getAdaptedCoordinates(path.points.coordinates)
  var mapBoxRoute =
    {
      'distance': path.distance,
      'duration': path.time / 1000,
      'geometry': polyline.encode(allCoordinates),
      'weight': path.time / 1000,
      'weight_name': 'routability',
      'legs': getLegs(path),
      'routeOptions': getRouteOptions(path, profile, mapboxKey),
      'voiceLocale': locale
    }
  return mapBoxRoute
}

function getLegs (path) {
  var legs = [{
    'distance': path.distance,
    'duration': path.time / 1000,
    'summary': getSummary(),
    'steps': getSteps()
  }]
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
  let index
  if (allInstructions.length > 1) {
    index = allInstructions.length - 2
  } else {
    index = 1
  }
  let streetName = allInstructions[index].street_name
  return streetName
}

function getAdaptedCoordinates (path) {
  var allCoordinates = path
  var index
  var len
  var newCoordinates = []
  for (index = 0, len = allCoordinates.length; index < len; ++index) {
    var pair = allCoordinates[index]
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
  }
  return modifier
}

function isFirstInstruction (instruction) {
  var bool = false
  if (getPreviousInstruction(instruction, allInstructions) === null) {
    bool = true
  }
  return bool
}

function isLastInstruction (instruction) {
  var bool = false
  if (getNextInstruction(instruction, allInstructions) === null) {
    bool = true
  }
  return bool
}

function getSteps () {
  var steps = []
  var index
  var len
  for (index = 0, len = allInstructions.length; index < len; ++index) {
    var instruction = allInstructions[index]

    var sectionPoints = [] // for geometry of this step
    sectionPoints.push(allCoordinates[instruction.interval[0]])
    sectionPoints.push(allCoordinates[instruction.interval[1]])
    let streetName = instruction.street_name
    if (isLastInstruction(instruction)) {
      streetName = getLastStreetName()
    }
    var step = {
      'name': streetName,
      'duration': instruction.time / 1000,
      'weight': instruction.time / 1000,
      'distance': instruction.distance,
      'geometry': polyline.encode(sectionPoints),
      'driving_side': 'right',
      'mode': 'driving',
      'maneuver': getManeuver(instruction),
      'intersections': [{
        'location': allCoordinatesGEO[instruction.interval[0]]
      }],
      'voiceInstructions': getVoiceInstructions(instruction),
      'bannerInstructions': getBannerInstructions(instruction)
    }
    steps.push(step)
  }
  return steps
}

function getManeuver (instruction) {
  var type = getType(instruction)
  var modifier
  if (type === 'arrive' && instruction.last_heading !== undefined) {
    modifier = getDirectionOfHeading(instruction.last_heading)
  } else {
    modifier = getMapboxModifier(instruction.sign)
  }

  var maneuver = {
    'bearing_before': getBearingBefore(instruction),
    'bearing_after': getBearingAfter(instruction),
    'location': allCoordinatesGEO[instruction.interval[0]],
    'modifier': modifier,
    'type': type,
    'instruction': instruction.text
  }
  if (type === 'roundabout') {
    maneuver['exit'] = instruction.exit_number
  }
  return maneuver
}

function getDirectionOfHeading (angle) {
  if (angle >= 180) { return 'left' } else { return 'right' }
}

function getType (instruction) {
  if (instruction === null) {
    return 'arrive'
  } else {
    if (isFirstInstruction(instruction)) {
      return 'depart'
    } else {
      switch (instruction.sign) {
        case 4: // Instruction.FINISH:
        case 5: // Instruction.REACHED_VIA:
          return 'arrive'
        case 6:// Instruction.USE_ROUNDABOUT:
          return 'roundabout'
        default:
          return 'turn'
      }
    }
  }
}

function getPreviousInstruction (instruction) {
  var index = allInstructions.indexOf(instruction)
  var prevInstruction = null
  if (index !== 0) {
    index = index - 1
    prevInstruction = allInstructions[index]
  }
  return prevInstruction
}

function getNextInstruction (instruction) {
  var index = allInstructions.indexOf(instruction)
  var nextInstruction = null
  if (index !== allInstructions.length - 1) {
    index = index + 1
    nextInstruction = allInstructions[index]
  }
  return nextInstruction
}

function getVoiceInstructions (instruction) {
  var voiceInstructions = []
  var distance = Math.floor(instruction.distance / 10) * 10
  departAnnouncementAlreadySaid = false
  if (isFirstInstruction(instruction)) {
    voiceInstructions.push(getSingleVoiceInstruction(distance, instruction, false))
    console.log('first instruction')
  }
  // different milestones are added for voice instructions, so the instruction is repeated after certain distances
  if (distance > FAR) {
    voiceInstructions.push(getSingleVoiceInstruction(FAR, instruction))
  }
  if (distance > MID) {
    voiceInstructions.push(getSingleVoiceInstruction(MID, instruction))
  }
  if (distance > CLOSE) {
    voiceInstructions.push(getSingleVoiceInstruction(CLOSE, instruction))
  } else if (distance > VERY_CLOSE) {
    voiceInstructions.push(getSingleVoiceInstruction(VERY_CLOSE, instruction))
  }
  let sayDist = false
  if (isLastInstruction(getNextInstruction(instruction))) { sayDist = true }
  if (distance < EXTREMELY_CLOSE) {
    voiceInstructions.push(getSingleVoiceInstruction(distance, instruction, sayDist))
  } else {
    var distanceAlongGeometry = EXTREMELY_CLOSE // 60m before turn final announcement is made
    voiceInstructions.push(getSingleVoiceInstruction(distanceAlongGeometry, instruction, sayDist))
  }
  return voiceInstructions
}

function getSingleVoiceInstruction (distanceAlongGeometry, instruction, sayDistance = true) {
  // Voice Instructions use the text of the next Manuever, so from the next instruction
  // For the beginning of the navigation however, you need the text of the current instruction
  let spokenInstruction = getNextInstruction(instruction)
  let nextInstruction = getNextInstruction(spokenInstruction)
  let departAnnouncement = '' // the very first announcement, often "follow route"
  let announcement = ''
  if (isFirstInstruction(instruction) && !departAnnouncementAlreadySaid) {
    departAnnouncement = instruction.text + getTranslatedSentenceConnector()
    departAnnouncementAlreadySaid = true
  }
  try {
    announcement = spokenInstruction.text
  } catch (e) {
    announcement = instruction.text
  }

  if (!sayDistance && shouldAddNextVoiceInstruction(spokenInstruction, nextInstruction)) {
    announcement += getTranslatedSentenceConnector() + nextInstruction.text
  }
  var voiceInstruction = {
    'distanceAlongGeometry': distanceAlongGeometry, // to compensate the delay of the spoken message
    'announcement': departAnnouncement + announcement,
    'ssmlAnnouncement': getSsmlAnnouncement(distanceAlongGeometry, announcement, sayDistance, departAnnouncement)
  }
  return voiceInstruction
}

function getSsmlAnnouncement (distanceAlongGeometry, announcement, sayDistance, departAnnouncement) {
  var distanceString = ''
  if (sayDistance) {
    distanceString = getTranslatedDistance(distanceAlongGeometry)
  }
  var ssml = '<speak><amazon:effect name="drc"><prosody rate="1.08">' + departAnnouncement + distanceString + announcement + ' </prosody></amazon:effect></speak>'
  return ssml
}

function shouldAddNextVoiceInstruction (instruction, nextInstruction) {
  if (nextInstructionExists(instruction) && isStepShort(nextInstruction) && !isLastInstruction(nextInstruction)) {
    return true
  } else {
    return false
  }
}

function nextInstructionExists (instruction) {
  if (getNextInstruction(instruction) === null) {
    return false
  } else {
    return true
  }
}

function isStepShort (instruction) {
  var bool = false
  if (!(instruction === null)) {
    if (instruction.distance < EXTREMELY_CLOSE) {
      bool = true
    }
  }
  return bool
}

function getBannerInstructions (instruction) {
  var prevInstruction = getPreviousInstruction(instruction)
  var nextInstruction = getNextInstruction(instruction)
  var distanceAlongGeometry
  var text
  var modifier
  var componentsText

  if (nextInstruction !== null) {
    distanceAlongGeometry = instruction.distance
    modifier = getMapboxModifier(nextInstruction.sign)
    if (isLastInstruction(nextInstruction)) { // Target reached is in 'text' key, not street_name
      componentsText = nextInstruction.text
      text = nextInstruction.text
    } else {
      componentsText = nextInstruction.street_name
      text = nextInstruction.street_name
    }
  } else {
    distanceAlongGeometry = 0
    text = prevInstruction.text // change this later
    modifier = ''
    componentsText = prevInstruction.street_name
  }
  var bannerInstruction = {
    'distanceAlongGeometry': distanceAlongGeometry,
    'primary': {
      'text': text,
      'type': getType(nextInstruction),
      'modifier': modifier,
      'components': [{ 'text': componentsText, 'type': 'text' }]
    }
  }
  if (nextInstructionExists(nextInstruction) && isStepShort(getNextInstruction(nextInstruction))) { // adds a sub banner if the next step is really short
    var sub = getSubBanner(nextInstruction)
    bannerInstruction['sub'] = sub
  }
  return [bannerInstruction]
}

function getSubBanner (primaryInstruction) { // primaryInstruction = instruction used for primary banner
  // not working as of yet, sub info gets ignored
  var instructionAfter = getNextInstruction(primaryInstruction)
  var sub = {
    'text': instructionAfter.street_name,
    'type': 'text',
    'modifier': getMapboxModifier(instructionAfter.sign),
    'components': [{ 'text': instructionAfter.street_name, 'type': 'text' }]
  }
  return sub
}

function convertProfile (profile) {
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
  var bearingBfP1 = allCoordinatesGEO[instruction.interval[0]]
  var bearingBfP2 = allCoordinatesGEO[instruction.interval[1]]
  var bearingBf = bearingCalc.bearing(bearingBfP1[0], bearingBfP1[1], bearingBfP2[0], bearingBfP2[1])
  return bearingBf
}

function getBearingAfter (nextInstruction) {
  var bearingAfP1 = allCoordinatesGEO[nextInstruction.interval[0]]
  var bearingAfP2 = allCoordinatesGEO[nextInstruction.interval[1]]
  var bearingAf = bearingCalc.bearing(bearingAfP1[0], bearingAfP1[1], bearingAfP2[0], bearingAfP2[1])
  return bearingAf
}

function generateUuid () {
  var id = ''
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (var i = 0; i < 25; i++) { id += possible.charAt(Math.floor(Math.random() * possible.length)) }
  return id
}

function getTranslatedDistance (distance) {
  let kilometres = { 'de': 'Kilometern', 'en': 'kilometres' }
  let metres = { 'de': 'Metern', 'en': 'metres' }
  var unit = 'Metern' // default
  let convertedDistance
  if (distance / 1000 >= 1) {
    unit = kilometres[locale]
    convertedDistance = distance / 1000
  } else {
    convertedDistance = distance
    unit = metres[locale]
  }
  let output = 'In ' + convertedDistance + unit + ' '
  return output
}

function getTranslatedSentenceConnector () {
  switch (locale) {
    case 'de': return ', dann '
    case 'en':
    case 'en-us': return ', then '
  }
}

function getRouteOptions (path, profile, accessKey) {
  let token = accessKey
  if (!accessKey) {
    token = ''
  }
  var routeOptions = {
    'baseUrl': 'https://api.mapbox.com',
    'user': 'mapbox',
    'profile': convertProfile(profile),
    'coordinates': path.snapped_waypoints.coordinates,
    'language': locale,
    'bearings': ';',
    'continueStraight': true,
    'roundaboutExits': true,
    'geometries': 'polyline6',
    'overview': 'full',
    'steps': true,
    'annotations': '',
    'voiceInstructions': true,
    'bannerInstructions': true,
    'voiceUnits': getUnitSystem(),
    'accessToken': token,
    'requestUuid': UUID
  }
  return routeOptions
}

function getUnitSystem () {
  let system
  switch (locale) {
    case 'en':
    case 'en-us': system = 'imperial'
      break
    default: system = 'metric'
  }
  return system
}
