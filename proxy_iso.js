const express = require('express')
const proxy = require('express-http-proxy')
const proxyService = express()
const port = 3000
const mapper = require('./directions_mapper')
const isoMapper = require('./isochrone_mapper')

let profile
let locale
let mapboxkey

proxyService.use('/api/1/route', proxy('https://graphhopper.com/', {
  proxyReqPathResolver (req) {
    profile = req.query.vehicle
    locale = req.query.locale
    mapboxkey = req.query.mapboxkey
    console.log(req.url)
    let url = req.url.replace('/', '/api/1/route')
    return url
  },
  userResDecorator: function (proxyRes, proxyResData, userReq, userRes) {
    let data = JSON.parse(proxyResData.toString('utf-8'))
    if (userRes.statusCode !== 200) {
      data['responseCode'] = userRes.statusCode
      return data
    } else {
      var mapBoxResponse = mapper.map(data, profile, locale, mapboxkey)
      console.log(mapBoxResponse)
      return JSON.stringify(mapBoxResponse)
    }
  }

})
)

let amountOfBuckets
let totalTime
let colorString

proxyService.use('/api/1/isochrone', proxy('https://graphhopper.com', {
  proxyReqPathResolver (req) {
    totalTime = req.query.time_limit
    amountOfBuckets = req.query.buckets
    colorString = req.query.contours_colors
    let url = req.url.replace('/', '/api/1/isochrone')
    return url
  },
  userResDecorator: function (proxyRes, proxyResData, userReq, userRes) {
    let data = JSON.parse(proxyResData.toString('utf-8'))

    if (userRes.statusCode !== 200) {
      data['responseCode'] = userRes.statusCode
      return data
    } else {
      let res = isoMapper.map(data, totalTime, amountOfBuckets, colorString)
      return JSON.stringify(res)
    }
  }
}))
console.log('Listening on port ' + port)
proxyService.listen(port)
