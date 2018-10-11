//Load express module with `require` directive
var express = require('express')
var proxy = require('express-http-proxy');
var proxyService = express();

var mapper = require('./mapper')
proxyService.use(proxy("https://graphhopper.com",{
  userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
    data = JSON.parse(proxyResData.toString('utf8'));
    var mapBoxResponse = mapper.map(data)
    return JSON.stringify(mapBoxResponse);
}
})
)
proxyService.listen(3000)
