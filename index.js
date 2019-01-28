const express = require('express')
const proxy = require('express-http-proxy')
const proxyService = express()
const helmet = require('helmet')
const Prometheus = require('./src/prometheus')
const port = 3000

const directionsMapper = require('./src/mappers/directions_mapper')
const isoMapper = require('./src/mappers/isochrone_mapper')
const optiMapper = require('./src/mappers/optimization_mapper')
const matrixMapper = require('./src/mappers/matrix_mapper')

const GH_BASE = 'https://graphhopper.com'
const SUCC_MSG = 'Succesful Mapping'

const bunyan = require('bunyan')
let loggerOptions = { name: 'maphopper' }
var log = bunyan.createLogger(loggerOptions)

// PROMETHEUS
/// The below arguments start the counter functions
proxyService.use(Prometheus.requestCounters)
proxyService.use(Prometheus.responseCounters)
// Enable metrics endpoint
Prometheus.injectMetricsRoute(proxyService)
// Enable collection of default metrics
Prometheus.startCollection()

function logProxyMessage (url) {
  log.info('request proxied to ' + GH_BASE)
}

function logError (msg, errorCode = 0) {
  let errorBody = { code: errorCode }
  if (errorCode === 0) {
    errorBody = {}
  }
  log.error(errorBody, msg)
}

proxyService.use(helmet())

proxyService.use('/api/1/route', proxy(GH_BASE, {
  proxyReqPathResolver (req) {
    let url = req.url.replace('/', '/api/1/route')
    logProxyMessage(url)
    return url
  },
  userResDecorator: function (proxyRes, proxyResData, userReq, userRes) {
    let data = JSON.parse(proxyResData.toString('utf-8'))
    if (userRes.statusCode !== 200) {
      data['responseCode'] = userRes.statusCode
      logError(data.message, userRes.statusCode)
      return data
    } else {
      if (userReq.query.points_encoded !== 'false') {
        let msg = 'points_encoded has to be false'
        data = { 'message': msg
        }
        logError(msg)
        return data
      }
      var mapBoxResponse = directionsMapper.getMapping(data, userReq.query.profile, userReq.query.locale, userReq.query.mapboxkey)
      log.info(SUCC_MSG)
      return JSON.stringify(mapBoxResponse)
    }
  }
})
)

proxyService.use('/api/1/isochrone', proxy(GH_BASE, {
  proxyReqPathResolver (req) {
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
      let res = isoMapper.getMapping(data, userReq.query.time_limit, userReq.query.buckets, userReq.query.contours_colors)
      log.info(SUCC_MSG)
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
      let res = optiMapper.getMapping(data)
      log.info(SUCC_MSG)
      return JSON.stringify(res)
    }
  }
}))

proxyService.use('/api/1/matrix', proxy(GH_BASE, {
  proxyReqPathResolver (req) {
    let url = req.url.replace('/', '/api/1/matrix')
    logProxyMessage(url)
    return url
  },
  userResDecorator: function (proxyRes, proxyResData, userReq, userRes) {
    let data = JSON.parse(proxyResData.toString('utf-8'))
    if (userRes.statusCode !== 200) {
      data['responseCode'] = userRes.statusCode
      return data
    } else {
      let res = matrixMapper.getMapping(data, userReq.query.out_array, userReq.query.from_point
        , userReq.query.to_point, userReq.query.point)
      log.info(SUCC_MSG)
      return JSON.stringify(res)
    }
  }
}))

proxyService.listen(port)
