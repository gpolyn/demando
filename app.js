// Require dependencies
var db = require('mongoskin').db('mongodb://192.168.59.103:27017/exampleDb'); 
var http = require('http');
var path = require('path');
var express = require('express');
var twilio = require('twilio');
var bodyParser = require('body-parser');
var Twitter = require('twitter');
require('dotenv').load();
 
var smss = db.collection('smss');
var tweets = db.collection('tweets');
var twitterClient = new Twitter({
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  access_token_key: process.env.ACCESS_TOKEN_KEY,
  access_token_secret: process.env.ACCESS_TOKEN_SECRET
});

// Create Express app and HTTP server, and configure socket.io
var app = express();
var server = http.createServer(app);
var io = require('socket.io')(server);
 
// Middleware to parse incoming HTTP POST bodies
app.use(bodyParser.urlencoded({ 
    extended: true 
}));
 
// Serve static content from the "static" directory
app.use(express.static(path.join(__dirname, 'static')));
 
// Configure port for HTTP server
app.set('port', process.env.PORT || 5050);
 
// Handle incoming MMS messages from Twilio
app.post('/twilio', function(request, response) {
    console.log('Received message.');
    var twiml = twilio.TwimlResponse();
    var numMedia = parseInt(request.body.NumMedia);
 
    if (numMedia > 0) {
        for (i = 0; i < numMedia; i++) {
            var mediaUrl = request.body['MediaUrl' + i];
            var messageSid = request.body['MessageSid'];
            var from = request.body['From'];
            var body = request.body['Body'];
            console.log('Displaying MediaUrl: ' + mediaUrl);
            smss.insert({mediaUrl: mediaUrl, messageSid: messageSid, from: from, body: body}, function (err, result) {
                console.log("persisted in mongo!");
                console.log(result);
            });
            io.emit('newMedia', mediaUrl);
        }
        twiml.message('Photo received - check the screen to see it pop up!');
    } else {
        twiml.message(':( Doesn\'t look like there was a photo in that message.');
    }
    
    response.type('text/xml');
    response.send(twiml.toString());
});

twitterClient.stream('statuses/filter', {track: 'pricelets'}, function(stream) {
  stream.on('data', function(tweet) {
    console.log(tweet.text);
    // console.log(tweet.user.screen_name);
     // console.log(tweet);
     console.log(tweet.entities.media);
    // var url = tweet.text.substr(tweet.text.indexOf("http"),tweet.text.length);
    // var url = "twitter.com/"+tweet.user.screen_name+"/statuses/"+tweet.id_str;
    // console.log("url is "+url);
    tweets.insert(tweet, function(err, result) {
        if(err) {
          // util.puts('Error! Could not save mailRaw. ' + err.reason);
          console.log('Error! Could not save mailRaw. ' + err);
        } else {
          io.emit('newMedia', tweet.entities.media[0].media_url);
          console.log("persisted in mongo!");
          console.log(result);
        }
    });
  });

  stream.on('error', function(error) {
    throw error;
  });
});
 
io.on('connection', function(socket){                                            
    socket.emit('connected', 'Connected!');                              
});
 
server.listen(app.get('port'), function() {
    console.log('Express server listening on *:' + app.get('port'));
});
