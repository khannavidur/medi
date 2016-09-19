// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-example-passport
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT
'use strict';

var
    loopback                    = require('loopback'),
    boot                        = require('loopback-boot'),
    app                         = module.exports = loopback(),
    AlchemyAPI                  = require('alchemy-api'),
    alchemy                     = new AlchemyAPI(process.env.ALCHEMY_KEY),


    // Passport configurators..
    loopbackPassport            = require('loopback-component-passport'),
    PassportConfigurator        = loopbackPassport.PassportConfigurator,
    passportConfigurator        = new PassportConfigurator(app),
    request                     = require('request'),
    bodyParser                  = require('body-parser'),
    flash                       = require('express-flash'),
    config                      = {},
    path                        = require('path'),
    ensureLoggedIn              = require('connect-ensure-login').ensureLoggedIn;

/*
    providers.json  - for fb oauth 
    a must to have dependency
*/
try {
    config = require('../providers.json');
} catch (err) {
    console.trace(err);
    process.exit(1); // fatal
}


/*
    app settings
*/
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// boot scripts mount components like REST API
boot(app, __dirname);

// to support JSON-encoded bodies
app.middleware('parse', bodyParser.json());

// to support URL-encoded bodies
app.middleware('parse', bodyParser.urlencoded({
    extended: true,
}));

// The access token is only available after boot
app.middleware('auth', loopback.token({
    model: app.models.accessToken,
}));

/* session settings */
app.middleware('session:before', loopback.cookieParser(app.get('cookieSecret')));

app.middleware('session', loopback.session({
    secret: 'ringLords',
    saveUninitialized: true,
    resave: true,
}));

passportConfigurator.init();

// We need flash messages to see passport errors
app.use(flash());

/* To serve statis js and css files*/
app.use(loopback.static('../public'));

passportConfigurator.setupModels({
    userModel: app.models.user,
    userIdentityModel: app.models.userIdentity,
    userCredentialModel: app.models.userCredential,
});

for (var s in config) {
    var c = config[s];
    c.session = c.session !== false;
    passportConfigurator.configureProvider(s, c);
}


/*
    APP Routes
*/
app.get('/auth/account', ensureLoggedIn('/login'), function(req, res, next) {
    var user_name,raw;
    app.models.userIdentity.find({where: {id: req.user.id}, limit: 3}, function(err, accounts) {
        user_name               = accounts[0].profile.displayName;
        raw                     = JSON.parse(accounts[0].profile._raw);
        req.user.username       = user_name;
        req.user.age            = raw.age_range.min;
        req.user.gender         = raw.gender.toUpperCase();
        res.render('pages/loginProfiles', {
            user    : req.user,
            url     : req.url
        });
    });
});


app.get('/', function(req, res, next) {
    res.render('pages/index', {
        user    : req.user,
        url     : req.url,
    });
});

app.get('/login', function(req, res, next) {
    res.render('pages/login', {
        user    : req.user,
        url     : req.url,
    });
});

app.post('/auth/local',ensureLoggedIn('/login'), function(req, res, next) {
    var user_name,raw,posts,sentiment = {};

    app.models.userIdentity.find({where: {id: req.user.id}, limit: 1}, function(err, accounts) {
        // Get User Information
        user_name = accounts[0].profile.displayName;
        raw = JSON.parse(accounts[0].profile._raw);
        posts = raw.posts.data;


        var dataToAnalyze = [];

        //get fb posts
        posts.forEach(function(post){
          if(post.message)
            dataToAnalyze.push(post.message);
        })

        //user answers
        Object.keys(req.body).forEach(function(key){
          dataToAnalyze.push(req.body[key] + '\n');
        });

        dataToAnalyze = dataToAnalyze.join('');
        console.log(dataToAnalyze);

        req.user.username = user_name;
        req.user.age = raw.age_range.min;
        req.user.gender = raw.gender.toUpperCase();


        alchemy.emotions(dataToAnalyze, {}, function(err, response) {
            if (err) console.log(err);

            var alchemy_emotions = response.docEmotions;
            //var alchemy_emotions = { 'anger': '0.349306','disgust': '0.029147','fear': '0.170442','joy': '0.083769','sadness': '0.223633' };
            console.log('alchemy_emotions',alchemy_emotions);
         
            alchemy.sentiment(dataToAnalyze, {}, function(err, resp) {
                if (err) console.log(err);
                var alchemy_sentiment = resp.docSentiment;
                //var alchemy_sentiment = { 'mixed': '1', 'score': '-0.218344', 'type': 'negative' };
                console.log('alchemy_sentiment',alchemy_sentiment);

                /*
                    CALLING VELOICE Telephony API
                    to alert the therapist
                */
                if(alchemy_sentiment.score <= -0.5){ 
                    var
                        headers                 = {
                            'Content-Type'      : 'application/json;charset=UTF-8',
                            'Accept'            : 'application/json, text/plain, */*'
                        },
                        dataString              = '{"device_id":"'+ process.env.DEVICE_ID +'","phoneNumber":'+ process.env.PHONE_NUMBER +'}',
                        options                 = {
                            url                 : 'http://app.veloice.com:3000/api/Devices/quickCall?access_token=' + process.env.ACCESS_TOKEN ,
                            method              : 'POST',
                            headers             : headers,
                            body                : dataString
                        };
                    request(options, function(error, response, body){

                        console.log(error, body);
                      
                        res.render('pages/results', {
                            user                : req.user,
                            url                 : req.url,
                            emotions            : JSON.stringify(alchemy_emotions),
                            alchemy_sentiment   : alchemy_sentiment.type.toUpperCase(),
                            score               : alchemy_sentiment.score
                        });
                    });
                } else {
                    res.render('pages/results', {
                        user                    : req.user,
                        url                     : req.url,
                        emotions                : JSON.stringify(alchemy_emotions),
                        alchemy_sentiment       : alchemy_sentiment.type.toUpperCase(),
                        score                   : alchemy_sentiment.score
                    });
                }
            });
        });
    });
});


app.get('/auth/logout', function(req, res, next) {
    req.logout();
    res.redirect('/');
});

app.start = function() {
    return app.listen(function() {
        app.emit('started');
    });
};

// start the server if `$ node server.js`
if (require.main === module) {
    app.start();
}
