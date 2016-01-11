var express = require('express');
var bodyParser = require("body-parser");
var EventEmitter = require('events').EventEmitter;
var app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var messageBus = new EventEmitter()  
messageBus.setMaxListeners(100) 

var chats = [];
var polling_arr = [];
var sse_arr = [];

app.get('/messaging', function(req, res) {
    res.sendFile(__dirname + '/messaging.html');
});

app.get('/polling', function(req, res) {
    res.sendFile(__dirname + '/polling.html');
});

app.get('/longpolling', function(req, res) {
    res.sendFile(__dirname + '/long-polling.html');
});

app.get('/sse', function(req, res) {
    res.sendFile(__dirname + '/sse.html');
});

app.get('/websocket', function(req, res) {
    res.sendFile(__dirname + '/websocket.html');
});

app.get('/polling/chat', function(req, res) {
    res.json(polling_arr.pop());
});

app.get('/longpolling/chat', function(req, res) {
    var addMessageListener = function(res) {
        messageBus.once('long-polling', function(data) {
            res.json(data)
        })
    };

    addMessageListener(res);
});

var openConnections = [];
app.get('/sse/chat', function(req, res) {
    // set timeout as high as possible
    req.socket.setTimeout(0);

    // send headers for event-stream connection
    // see spec for more information
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    res.write('\n');

    // push this res object to our global variable
    openConnections.push(res);

    req.on("close", function() {
        var toRemove;
        for (var j =0 ; j < openConnections.length ; j++) {
            if (openConnections[j] == res) {
                toRemove =j;
                break;
            }
        }
        openConnections.splice(j,1);
    });
});

setInterval(function() {
    // we walk through each connection
    openConnections.forEach(function(res) {
        var msg = ''
        if (sse_arr.length > 0) {
            msg = sse_arr.pop();
        }
        
        res.write('data:' + msg + '\n\n'); // Note the extra newline
    });
}, 1000);

app.post('/chat', function (req, res) {
    polling_arr.push(req.body.message);
    sse_arr.push(req.body.message);
    messageBus.emit('long-polling', req.body.message)
    messageBus.emit('sse', req.body.message)
    res.json(req.body);
});

var server = app.listen(3000, function() {
    var host = server.address().address;
    var port = server.address().port;

    console.log("host: " + host);
    console.log("port: " + port);
    console.log('Example app listening at http://%s:%s', host, port);
});

var WebSocketServer = require('websocket').server;
wsServer = new WebSocketServer({
    httpServer: server
});

wsServer.on('request', function(req){
    var connection = req.accept('echo-protocol', req.origin);
    var count = 0;
    var clients = {};
    // Specific id for this client & increment count
    var id = count++;
    // Store the connection method so we can loop through & contact all clients
    clients[id] = connection
    console.log((new Date()) + ' Connection accepted [' + id + ']');

    // Create event listener
    connection.on('message', function(message) {
        // The string message that was sent to us
        var msgString = message.utf8Data;
        // Loop through all clients
        for(var i in clients){
            // Send a message to the client with the message
            clients[i].sendUTF(msgString);
        }

    });

    connection.on('close', function(reasonCode, description) {
        delete clients[id];
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });
});

