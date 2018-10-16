const express = require('express')
const proxy = require('express-http-proxy')
const proxyService = express()
const port = 3000
const mapper = require('./mapper')

let profile
let locale
let mapboxkey

proxyService.use(proxy('https://graphhopper.com', {
  proxyReqPathResolver (req) {
    profile = req.query.vehicle
    locale = req.query.locale
    mapboxkey = req.query.mapboxkey
    return req.url
  },
  userResDecorator: function (proxyRes, proxyResData, userReq, userRes) {
    let data = JSON.parse(proxyResData.toString('utf-8'))
    if (userRes.statusCode !== 200) {
      data['reponseCode'] = userRes.statusCode
      return data
    } else {
      var mapBoxResponse = mapper.map(data, profile, locale, mapboxkey)
      console.log(mapBoxResponse)
      return JSON.stringify(mapBoxResponse)
    }
  }

})
)
console.log('Listening on port ' + port)
proxyService.listen(port)
