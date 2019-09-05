// const addComment = require('../../src/action/addComment');

const app = require('express')();
const axios = require('axios');
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = 5050;

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket){
  socket.on('chat message', function(index,user,msg){
    io.emit('chat message',index,user, msg);
    axios.put(`http://localhost:5000/news/:${index}`, {"user": user, "msg": msg});
    console.log(`User ${user} wrote message`);
  });
});


io.on('connection', function(socket){
  console.log('user connected');
  socket.on('disconnect', function(){
    console.log('user disconnected');
  });
});


http.listen(port, function(){
  console.log('listening on ' + port);
});
