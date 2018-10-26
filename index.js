const express = require('express')
const proxy = require('express-http-proxy')
const proxyService = express()
const helmet = require('helmet')

const port = 3000

const mapper = require('./mappers/directions_mapper')
const isoMapper = require('./mappers/isochrone_mapper')
const optiMapper = require('./mappers/optimization_mapper')
const matrixMapper = require('./mappers/matrix_mapper')

const GH_BASE = 'https://graphhopper.com'

let profile
let locale
let mapboxkey
let pointsEncoded

function logProxyMessage (url) {
  console.log(url)
  console.log('proxied to ' + GH_BASE)
}

proxyService.use(helmet())

proxyService.use('/api/1/route', proxy(GH_BASE, {
  proxyReqPathResolver (req) {
    profile = req.query.vehicle
    locale = req.query.locale
    mapboxkey = req.query.mapboxkey
    pointsEncoded = req.query.points_encoded
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
      if (pointsEncoded !== 'false') {
        data = { 'message': 'points_encoded has to be false'
        }
        return data
      }
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

let outArray
let fromPoints
let toPoints
let points
proxyService.use('/api/1/matrix', proxy(GH_BASE, {
  proxyReqPathResolver (req) {
    let url = req.url.replace('/', '/api/1/matrix')
    outArray = req.query.out_array
    fromPoints = req.query.from_point
    toPoints = req.query.to_point
    points = req.query.point
    logProxyMessage(url)
    return url
  },
  userResDecorator: function (proxyRes, proxyResData, userReq, userRes) {
    let data = JSON.parse(proxyResData.toString('utf-8'))
    if (userRes.statusCode !== 200) {
      data['responseCode'] = userRes.statusCode
      return data
    } else {
      let res = matrixMapper.map(data, outArray, fromPoints, toPoints, points)
      return JSON.stringify(res)
    }
  }
}))

console.log('Listening on port ' + port)
proxyService.listen(port)
