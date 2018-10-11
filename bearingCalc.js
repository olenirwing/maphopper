function toRadians(degrees) {
  return degrees * Math.PI / 180;
};

// Converts from radians to degrees.
function toDegrees(radians) {
  return radians * 180 / Math.PI;
}


exports.bearing = function(startLat, startLng, destLat, destLng){
  startLat = toRadians(startLat);
  startLng = toRadians(startLng);
  destLat = toRadians(destLat);
  destLng = toRadians(destLng);

  y = Math.sin(destLng - startLng) * Math.cos(destLat);
  x = Math.cos(startLat) * Math.sin(destLat) -
        Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLng - startLng);
  brng = Math.atan2(y, x);
  brng = toDegrees(brng);
  return (((brng + 360) % 360) | 0);
}
