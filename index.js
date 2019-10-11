const express = require('express');
const index = express();
const server = require('http').createServer(index);//new for sockets
const axios = require('axios');
const bodyPareser = require('body-parser');
const cors = require('cors');
const _ = require("lodash");
const randtoken = require('rand-token').suid;
const fileUpload = require('express-fileupload');
const geoip = require('geoip-lite');
const jwtDecode = require('jwt-decode');
const moment = require('moment');
const fs = require('fs');
const io = require('socket.io')(server);

const stats = require('./stats');
const Users = require('./users');

const NEWS_API = 'https://newsapi.org/v2';
const source = 'top-headlines?country=';
const global = 'everything?domains=wsj.com';
const KEY = '19c35e4ad3b54f4faae2dfc9b75ea8f7';
const port = process.env.PORT || '5000';

let users = Users;
let tokens=[];
let statistics = stats;
let news = {
    "global":[]
};

index.use(bodyPareser.json());
index.use(bodyPareser.urlencoded({extended: true}));
index.use(cors());
index.use(fileUpload());
index.use('/images', express.static(__dirname + '/images'));

// setInterval(()=>axios.get(`https://newssss-api.herokuapp.com/`), 300000);

index.get('/', (req, res) => {
    res.send("api-news doesn't sleep")
});

index.get('/news', (req, res) => {
    const countryCode = req.query.source;
    const cluster = JSON.parse(JSON.stringify(countryCode));

    axios.get(`${NEWS_API}/${countryCode === "global" ? global : `${source}${countryCode}`}&apiKey=${KEY}`)
        .then(response => {
            return response.data.articles
        })
        .then(data => {
            return data.map(({author, source, title, description, url, urlToImage, publishedAt}) => {
                return {
                    author: author,
                    "title": title,
                    description: description,
                    source: source.name,
                    url: url,
                    "urlToImage": (urlToImage && urlToImage.split("://")[0] === "http") ? `https://${urlToImage.split("://")[1]}` : urlToImage,
                    publishedAt: publishedAt,
                    comments: [],
                    id: `f${(~~(Math.random() * 1e8)).toString(16)}`
                }
            });
        })
        .then(data => {
            news[cluster] = _.unionBy(news[cluster], data, "publishedAt");
            res.send(news[cluster]);
        })
        .catch(() => {
            res.send("Error");
        });
});

index.get('/users', (req, res) => {
    res.send(users);
});

index.get('/statistics', (req, res) => {
    res.send(statistics);
});

index.post('/user', (req, res) => {
    let id = `f${(~~(Math.random()*1e8)).toString(16)}`;
    users.push({id, ...req.body});

    fs.writeFile(`${__dirname}/users.json`, JSON.stringify(users, null, 4), (err) => {
        if (err) {  console.error(err);  return false }
    });

    res.send(req.body);
});

index.post('/statistics', (req, res) => {
    const ip = jwtDecode(req.query.token).token;
    const geo = geoip.lookup(ip);
    const {country, city, timezone, ll, range} = geo;
    const same = statistics.find((item)=> item.ip === ip);
    const data = {
        ip, country, city, timezone, ll, range,
        visitedAt : moment().utc().format('YYYY-MM-DD HH:mm')
    };

    if(!same){
        statistics.unshift(data);
    }else {
        const now = new Date(moment().utc().format('YYYY-MM-DD HH:mm'));
        const expiration = new Date(same.visitedAt);
        if ((now - expiration) >= 5){
            statistics.unshift(data);
        }
    }

    fs.writeFile(`${__dirname}/stats.json`, JSON.stringify(statistics, null, 4), (err) => {
        if (err) {  console.error(err);  return false }
    });

    res.sendStatus(200);
});

index.post('/article', (req, res) => {
    const newArticle = {
        id: `f${(~~(Math.random() * 1e8)).toString(16)}`,
        ...req.body
    };
    const source = req.query.source ? req.query.source : "global";
    const cluster = JSON.parse(JSON.stringify(source));

    if(req.files && req.files.main_image){
        const imageFile = req.files.main_image;

        newArticle.urlToImage = `${req.protocol}://${req.headers.host}/images/${imageFile.name}`;
        imageFile.mv(`${__dirname}/images/${imageFile.name}`);
    }

    news[cluster].unshift(newArticle);
    res.send(newArticle);
});

index.post('/comment', (req, res) => {
    const {source, articleId} = req.query;
    const cluster = JSON.parse(JSON.stringify(source));
    news[cluster].map((article) => {
        if (article.id === articleId) {
            const comment = {id: `f${(~~(Math.random() * 1e8)).toString(16)}`, ...req.body};

            article.comments.unshift(comment);
            res.send({id:article.id, comment});
        }
    });
});

index.delete('/comment', (req, res) => {
    const {source, articleId, commentId} = req.query;
    const cluster = JSON.parse(JSON.stringify(source));
    news[cluster].map((article) => {
        if (article.id === articleId) {
            article.comments = article.comments.filter(({id})=> id !== commentId);
            res.send({articleId, commentId});
        }
    });
});

index.post('/login', (req, res) => {
    const {email, password} = req.body;
    const user = users.find( user => user.email === email && user.password === password);

    if(user){
        const {password, ...response} = user;
        const token = randtoken(16);

        tokens.push({"token": token, "id": user.id});
        tokens =_.uniqBy(tokens, 'id');

        // res.cookie('token',token, { maxAge:  60000 * 15 });
        res.send({response, token});
    }else {
        res.send(false);
    }
});

index.get('/session',(req, res) => {
    if (tokens.length===0){
        res.send(false);
    } else {
        const userId = tokens.find(item => item.token === req.query.token).id;
        const user = users.find(item => item.id === userId);
        const {password, ...respond} = user;
        if (user){
            res.send(respond)
        } else {
            res.send(false);
        }
    }
});

index.get('/logout',(req, res) => {
    if (req.query.token) {
        tokens = tokens.filter((item) => req.query.token !== item.token);
        res.send("OK");
    }else {
        res.send("Error");
    }
});


index.put('/news/:index', (req, res) => {
    news.map((article, index) => {
        if (index === +req.params.index.slice(1)) {
            return article.comments.push({
                user: req.body.user,
                comment: req.body.msg
            });
        }
        return article
    });
    res.sendStatus(200);
    console.log('ADD COMMENT BY ' + req.body.user);
});


//update data
index.put('/user/:id', (req, res) => {
    users.map((user) => {
        if (user.id === req.params.id) {
            return Object.assign(user, req.body)
        }
        return user;
    });

    let user = users.find(user => user.id === req.params.id),
    {password, ...respond} = user;
    if (user){
        res.send(respond)
    } else {
        res.error("user doesn't exist");
    }
});

//delete data
index.delete('/users/:name', (req, res) => {
    users = users.filter((user) => {
        return user.name !== req.params.name;
    });
    res.sendStatus(200);
    console.log('DELETE USER ' + req.params.name.toUpperCase());
});

index.delete('/article', (req, res) => {
    const {id, type} = req.query;
    let cluster = JSON.parse(JSON.stringify(type));

    news[cluster] = news[cluster].filter((item) => {
        return item.id !== id;
    });
    res.send({id: id});
});

index.get('/download', function(req, res){   //download?id=f5aa21&type=stats
    const {id, type} = req.query;
    const admin = users.find(user => user.id === id);

    if(admin){
        if (type === "stats"){
            res.download(`${__dirname}/stats.json`);
        } else if(type === "users"){
            res.download(`${__dirname}/users.json`);
        }
    }else {
        res.send("Permission deny")
    }
});


io.on('connection', function(socket){
    console.log('user connected');

    socket.on('post comment', function(data){
        console.log(data);
        const {newsSource, id, author, content, publishedAt} = data;
        const cluster = JSON.parse(JSON.stringify(newsSource));
        news[cluster].map((article) => {
            if (article.id === id) {
                const comment = {id: `f${(~~(Math.random() * 1e8)).toString(16)}`, author, comment: content, publishedAt};
                article.comments.unshift(comment);
                io.emit('post comment',{id:article.id, comment});
            }
        });
    });

    socket.on('delete comment', function(data){
        console.log(data);
        const {newsSource, articleId, commentId} = data;
        const cluster = JSON.parse(JSON.stringify(newsSource));
        news[cluster].map((article) => {
            if (article.id === articleId) {
                article.comments = article.comments.filter(({id})=> id !== commentId);
                io.emit('delete comment',{articleId, commentId});
            }
        });
    });

    socket.on('disconnect', function(){
        console.log('user disconnected');
    });
});

server.listen(port, () => console.log(`listening on port ${port}`));
// index.listen(port, () => console.log(`listening on port ${port}`));