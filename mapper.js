var polyline = require('@mapbox/polyline')
var bearingCalc = require('./bearingCalc')

var allInstructions
var allCoordinates
var allCoordinatesGEO
var locale

var FAR = 2000
var MID = 1000
var CLOSE = 400
var VERY_CLOSE = 200
var EXTREMELY_CLOSE = 60

exports.map = function (jsonRes, profile, _locale, mapboxKey) {
  console.log('#####################')
  var path = jsonRes.paths[0]
  allInstructions = path.instructions
  allCoordinatesGEO = path.points.coordinates // coordinates in GEOJJSON format
  allCoordinates = getAdaptedCoordinates(path.points.coordinates)
  locale = _locale
  var mapBoxResponse =
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
  return mapBoxResponse
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
  var firstStreet = allInstructions[0].street_name
  var index = 0
  if (allInstructions.length > 1) {
    index = allInstructions.length - 2
  }
  var lastStreet = allInstructions[index].street_name
  var summary = 'GraphHopper Route: ' + firstStreet + ' to ' + lastStreet
  return summary
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

    var step = {
      'name': instruction.street_name,
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
  var maneuver = {
    'bearing_before': getBearingBefore(instruction),
    'bearing_after': getBearingAfter(instruction),
    'location': allCoordinatesGEO[instruction.interval[0]],
    'modifier': getMapboxModifier(instruction.sign),
    'type': type,
    'instruction': instruction.text
  }
  if (type === 'roundabout') {
    maneuver['exit'] = instruction.exit_number
  }
  return maneuver
}

function getType (instruction) {
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
  var distance = instruction.distance

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
  if (distance < EXTREMELY_CLOSE) {
    voiceInstructions.push(getSingleVoiceInstruction(distance, instruction, true))
  } else {
    var distanceAlongGeometry = EXTREMELY_CLOSE // 60m before turn final announcement is made
    voiceInstructions.push(getSingleVoiceInstruction(distanceAlongGeometry, instruction, true))
  }
  return voiceInstructions
}

function getSingleVoiceInstruction (distanceAlongGeometry, instruction, closeToManeuver = false) {
  let nextInstruction = getNextInstruction(instruction)
  let announcement = instruction.text
  if (closeToManeuver && shouldAddNextVoiceInstruction(instruction, nextInstruction)) {
    announcement += getTranslatedSentenceConnector() + nextInstruction.text
  }
  var voiceInstruction = {
    'distanceAlongGeometry': distanceAlongGeometry,
    'announcement': announcement,
    'ssmlAnnouncement': getSsmlAnnouncement(distanceAlongGeometry, announcement, closeToManeuver)
  }
  return voiceInstruction
}

function getSsmlAnnouncement (distanceAlongGeometry, announcement, closeToManeuver) {
  var distanceString = ''
  if (!closeToManeuver) {
    distanceString = getTranslatedDistance(distanceAlongGeometry)
  }
  var ssml = '<speak><amazon:effect name="drc"><prosody rate="1.08">' + distanceString + announcement + ' </prosody></amazon:effect></speak>'
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
    text = nextInstruction.street_name
    modifier = getMapboxModifier(nextInstruction.sign)
    componentsText = nextInstruction.street_name
  } else {
    distanceAlongGeometry = 0
    text = prevInstruction.street_name // change this later
    modifier = ''
    componentsText = prevInstruction.street_name
  }
  var bannerInstruction = {
    'distanceAlongGeometry': distanceAlongGeometry,
    'primary': {
      'text': text,
      'type': 'text',
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
    'requestUuid': generateUuid()
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
