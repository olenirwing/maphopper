var polyline = require('@mapbox/polyline')
var bearingCalc = require('bearingCalc');

exports.map = function (jsonRes) {
    var paths = jsonRes.paths[0];
    var allCoordinatesGEO = paths.points.coordinates
    var allCoordinates = getAdaptedCoordinates(paths.points.coordinates);
    var steps = getSteps(paths,allCoordinates,allCoordinatesGEO);
    var mapBoxResponse =
    {
      "distance":paths.distance,
      "duration":paths.time / 1000,
      "geometry":polyline.encode(allCoordinates),
      "weight": paths.time/1000,
      "weight_name":"routability",
      "legs": [{
        "distance":paths.distance,
        "duration":paths.time/1000,
        "summary":"",
        "steps": steps,
      }],
      "routeOptions": getRouteOptions(paths)
      }

      return mapBoxResponse;
    };

function getAdaptedCoordinates(paths){
  var allCoordinates = paths
  var index;
  var len;
  var newCoordinates = [];
  for (index = 0, len = allCoordinates.length;index < len; ++index){
    var pair = allCoordinates[index];
    var x = pair[1] * 10
    var y = pair[0] * 10
    newCoordinates[index] = [x,y];
  }
  return newCoordinates;
}


function getMapboxModifier(sign){
        var modifier = "straight";
        switch(sign){
            case -7:
              modifier = "straight"
              break;
            case -3:
              modifier = "sharp left";
              break;
            case -2:
              modifier = "left";
              break;
            case -1:
              modifier = "slight left";
              break;
            case 0:
              modifier = "straight";
              break;
            case 1:
              modifier = "slight right";
              break;
            case 2:
              modifier = "right";
              break;
            case 3:
              modifier = "sharp right";
              break;
            case 6:
              modifier = "straight";
              break;
            case 7:
              modifier = "straight";
              break;
        }
        return modifier;
}


function getSteps(paths,allCoordinates, allCoordinatesGEO){
  var steps = []
  var index;
  var len;
  for (index = 0, len = paths.instructions.length; index < len; ++index){
    var instruction = paths.instructions[index]

    var nextInstruction = instruction;
    var type = "";
    if (paths.instructions.indexOf(instruction) < paths.instructions.length - 1){
      nextInstruction = paths.instructions[paths.instructions.indexOf(instruction)+1]
      if(paths.instructions.indexOf(instruction) == 0){
        type = "depart";
      } else {type = "turn";}
    } else{ type = "arrive";}

    var sectionPoints = []
    sectionPoints.push(allCoordinates[instruction.interval[0]])
    sectionPoints.push(allCoordinates[instruction.interval[1]])

    var bearingBfP1 = allCoordinatesGEO[instruction.interval[0]]
    var bearingBfP2 = allCoordinatesGEO[instruction.interval[1]]
    var bearingBf = bearingCalc.bearing(bearingBfP1[0],bearingBfP1[1],bearingBfP2[0],bearingBfP2[1])
    var bearingAfP1 = allCoordinatesGEO[nextInstruction.interval[0]]
    var bearingAfP2 = allCoordinatesGEO[nextInstruction.interval[1]]
    var bearingAf = bearingCalc.bearing(bearingAfP1[0],bearingAfP1[1],bearingAfP2[0],bearingAfP2[1])
    console.log(bearingBf,bearingAf)
    var step = {
      "name":instruction.street_name,
      "duration":instruction.time / 1000,
      "weight": instruction.time/1000,
      "distance":instruction.distance,
      "geometry": polyline.encode(sectionPoints),
      "driving_side":"right",
      "mode":"driving",
      "maneuver":{
        "bearing_before": bearingBf,
        "bearing_after": bearingAf,
        "location":allCoordinatesGEO[instruction.interval[0]],
        "modifier": getMapboxModifier(instruction.sign),
        "type": type,
        "instruction":instruction.text,
      },
      "intersections":[{
                "location":[0,0]
              }],
      "voiceInstructions":[],
      "bannerInstructions":[
        {
            "distanceAlongGeometry":instruction.distance,
            "primary":{
              "text": nextInstruction.street_name,
              "type": "text",
              "modifier": getMapboxModifier(nextInstruction.sign), //////// ADD getMapboxModifier
              "components":[
                {
                    "text": nextInstruction.street_name,
                    "type": "text"
                }

              ]
            }
          }
      ],
    }
    steps.push(step);
  }
  return steps;
}

function generateUuid(){
  var id = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < 25; i++)
    id += possible.charAt(Math.floor(Math.random() * possible.length));
  console.log(id)
  return id;
}

function getRouteOptions(paths){
  var routeOptions = {
      "baseUrl":"https://api.mapbox.com",
      "user":"mapbox",
      "profile":"driving",
      "coordinates":paths.snapped_waypoints.coordinates,
      "language":"de",
      "bearings":";",
      "continueStraight":true,
      "roundaboutExits":true,
      "geometries":"polyline",
      "overview":"full",
      "steps":true,
      "annotations":"",
      "voiceInstructions":true,
      "bannerInstructions":true,
      "voiceUnits":"metric",
      "accessToken":"pk.eyJ1Ijoib2xlbmlyd2luZyIsImEiOiJjam1xM21vaWQwdGdqM3ZwbmM5Z3A0Mjl1In0.GV0vOW4dT8uWB7wYwj9AoQ",
      "requestUuid": generateUuid()
    }
    return routeOptions;
}
