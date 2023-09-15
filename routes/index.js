var express = require('express');
var router = express.Router();
var Fingerprint = require('express-fingerprint')

router.use(Fingerprint({
    parameters:[
        // Defaults
        Fingerprint.useragent,
        Fingerprint.acceptHeaders,
        Fingerprint.geoip
    ]
}))

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

/* Get a token */

var token = require('../api/token');

router.post('/token/', token);

module.exports = router;
