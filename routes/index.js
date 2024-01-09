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


/* Post the quiz data */

var token = require('../api/quiz');

router.post('/quiz/', token);


module.exports = router;
