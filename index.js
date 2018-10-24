const express = require('express')
const proxy = require('express-http-proxy')
const proxyService = express()
const port = 3000
const mapper = require('./directions_mapper')
const isoMapper = require('./isochrone_mapper')
const optiMapper = require('./optimization_mapper')

const GH_BASE = 'https://graphhopper.com'

let profile
let locale
let mapboxkey

function logProxyMessage (url) {
  console.log(url)
  console.log('proxied to ' + GH_BASE)
}

proxyService.use('/api/1/route', proxy(GH_BASE, {
  proxyReqPathResolver (req) {
    profile = req.query.vehicle
    locale = req.query.locale
    mapboxkey = req.query.mapboxkey
    let url = req.url.replace('/', '/api/1/route')
    logProxyMessage(url)
    return url
  },
  userResDecorator: function (proxyRes, proxyResData, userReq, userRes) {
    let data = JSON.parse(proxyResData.toString('utf-8'))
    if (userRes.statusCode !== 200) {
      data['responseCode'] = userRes.statusCode
      return data
    } else {
      var mapBoxResponse = mapper.map(data, profile, locale, mapboxkey)
      return JSON.stringify(mapBoxResponse)
    }
  }
})
)

let amountOfBuckets
let totalTime
let colorString

proxyService.use('/api/1/isochrone', proxy(GH_BASE, {
  proxyReqPathResolver (req) {
    totalTime = req.query.time_limit
    amountOfBuckets = req.query.buckets
    colorString = req.query.contours_colors
    let url = req.url.replace('/', '/api/1/isochrone')
    logProxyMessage(url)
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

proxyService.use('/api/1/vrp', proxy(GH_BASE, {
  proxyReqPathResolver (req) {
    let url = req.url.replace('/', '/api/1/vrp/')
    logProxyMessage(url)
    return url
  },
  userResDecorator: function (proxyRes, proxyResData, userReq, userRes) {
    let data = JSON.parse(proxyResData.toString('utf-8'))
    if (userRes.statusCode !== 200 || data.status !== 'finished') {
      data['responseCode'] = userRes.statusCode
      return data
    } else {
      let res = optiMapper.map(data)
      return JSON.stringify(res)
    }
  }
}))

console.log('Listening on port ' + port)
proxyService.listen(port)
