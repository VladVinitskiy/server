const express = require('express');
const index = express();
const server = require('http').createServer(index);
const axios = require('axios');
const bodyPareser = require('body-parser');
const cors = require('cors');
const _ = require("lodash");
const randtoken = require('rand-token').suid;
const fileUpload = require('express-fileupload');
const geoip = require('geoip-lite');
const jwtDecode = require('jwt-decode');
const fs = require('fs');
const io = require('socket.io')(server);
const mongoose = require('mongoose');
const path = require("path");

const NEWS_API = 'https://newsapi.org/v2';
const source = 'top-headlines?country=';
const global_url = 'everything?domains=wsj.com';
const KEY = '19c35e4ad3b54f4faae2dfc9b75ea8f7';
const uri = "mongodb+srv://kalitsinskiy:09042000@news-db-zzeau.mongodb.net/news?retryWrites=true&w=majority";
const port = process.env.PORT || '5000';

const User = require("./models/user");
const News = require("./models/article");
const Statistics = require("./models/statistics");
const Image = require("./models/image");

const clusters = ["global", "ua", "au", "ca", "fr", "de", "it", "ru", "gb"];
let tokens=[];

index.use(bodyPareser.json());
index.use(bodyPareser.urlencoded({extended: true}));
index.use(cors());
index.use(fileUpload());
index.use('/images', express.static(path.join(__dirname, 'images')));

mongoose.connect( uri, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true });

index.get('/', (req, res) => {
    res.send("Hello, it's a news-api")
});

index.get('/news', (req, res) => {
    const cluster = JSON.parse(JSON.stringify(req.query.source));

    News.find({cluster: cluster})
        .exec()
        .then( response => res.status(200).json(response.reverse()))
        .catch(err => res.status(500).json(err));
});

index.get('/users', (req, res) => {
    User.find()
        .exec()
        .then( response => res.status(200).json(response))
        .catch(err => res.status(404).json(err));
});

index.get('/statistics', (req, res) => {
    Statistics.find()
        .exec()
        .then( response => res.status(200).json(response))
        .catch(err => res.status(404).json(err));
});

index.post('/user', (req, res) => {
    const user = new User({...req.body, _id: new mongoose.Types.ObjectId()});

    user.save()
        .then( response => res.status(200).json(response))
        .catch(err => res.status(404).json(err));
});

index.post('/statistics', (req, res) => {
    const ip = jwtDecode(req.query.token).token;
    const geo = geoip.lookup(ip);
    const {country, city, timezone, ll, range} = geo;
    const data = {
        ip, country, city, timezone, ll, range,
        visitedAt: req.body.date
    };
    const stats = new Statistics({
        ...data,
        id: new mongoose.Types.ObjectId()
    });

    stats.save()
        .then(response => res.status(200).json(response))
        .catch(err => res.status(404).json(err));
});

index.post('/article', (req, res) => {
    const {author, title, description, source, publishedAt} = req.body;
    const cluster = JSON.parse(JSON.stringify(req.query.source ? req.query.source : "global"));
    const imageFile = req.files && req.files.main_image;

    const article = new News({
        author, title,
        description, source,
        url: null,
        urlToImage: null,
        publishedAt,
        comments: [],
        cluster: cluster,
        custom: true,
        id: new mongoose.Types.ObjectId()
    });


    if(imageFile){
        article.urlToImage = `${req.protocol}://${req.headers.host}/images/${imageFile.name}`;
        imageFile.mv(`${__dirname}/images/${imageFile.name}`);

        const new_img = new Image({
            img: imageFile.data,
            name: imageFile.name,
            id: new mongoose.Types.ObjectId()
        });

        new_img.save();
    }

    article.save()
        .then( response => res.status(200).json(response))
        .catch(err => res.status(500).json(err));
});

index.put('/article', (req, res) => {
    const editArticle = {...req.body};
    const id = JSON.parse(JSON.stringify(req.query.id));

    if (editArticle.main_image){
        editArticle.urlToImage = editArticle.main_image
    }

    News.updateOne({id}, {$set: {...editArticle}})
        .then(() => {
            if (req.files && req.files.main_image) {
                const imageFile = req.files.main_image;

                editArticle.urlToImage = `${req.protocol}://${req.headers.host}/images/${imageFile.name}`;
                imageFile.mv(`${__dirname}/images/${imageFile.name}`);
            }
        })
        .then(() => res.status(200).json({id, ...editArticle}))
        .catch(err => res.status(500).json(err));
});

index.post('/login', (req, res) => {
    const {email, password} = req.body;

    User.findOne({ email, password})
        .exec()
        .then( response => {
            if(response){
                const token = randtoken(16);

                tokens.push({"token": token, "id": response.id});
                tokens =_.uniqBy(tokens, 'id');

                res.status(200).json({response, token})
            }else {
                res.status(403).json("user not found")
            }
        })
        .catch(err => res.status(401).json(err));
});

index.get('/session',(req, res) => {
    if (tokens.length===0){
        res.status(403)
    } else {
        const id = tokens.find(item => item.token === req.query.token).id;

        User.findOne({id})
            .exec()
            .then( response => {
                if (response){
                    res.status(200).json(response)
                }else {
                    res.status(403)
                }
            })
            .catch(err => res.status(401).json(err));
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

index.put('/user/:id', (req, res) => {
    const {id} = req.params;
    User.updateOne({id}, {$set: req.body})
        .then(response => {
            if(response){
                User.findOne({id})
                    .exec()
                    .then( response => res.status(200).json(response))
                    .catch(() => res.status(404).json("user doesn't exist"));
            }else {
                res.status(404).json("user doesn't exist")
            }
        })
        .catch(err => res.status(404).json(err));
});


index.delete('/article', (req, res) => {
    const {id, type} = req.query;
    let cluster = JSON.parse(JSON.stringify(type));

    News.deleteOne({id, cluster: cluster})
        .exec()
        .then( () => res.status(200).json({id}))
        .catch((err) => res.status(404).json(err));
});

index.get('/update_images', (req, res) => {
    Image.find()
        .exec()
        .then((response) => {
            response.map(({name, img}) => {
                fs.writeFile(`images/${name}`, img, function(err){});
            })
        })
        .then(() => res.status(500).json("ok"))
        .catch(err => res.status(500).json(err))
});

index.get('/update_news', (req, res) => {
    News.find({custom: false})
        .exec()
        .then( response => {
            let idsArr = [];
            response.forEach(({id}) => idsArr.push(id));

            News.deleteMany({id: { $in: idsArr}});
        })
        .then(() => {
            clusters.map((countryCode) =>{
                return axios.get(`${NEWS_API}/${countryCode === "global" ? global_url : `${source}${countryCode}`}&apiKey=${KEY}`)
                    .then(response => {
                        return response.data.articles
                    })
                    .then(data => {
                        data.map(({author, source, title, description, url, urlToImage, publishedAt}) => {
                            const article = News({
                                author: author,
                                title: title,
                                description: description,
                                source: source.name,
                                url: url,
                                urlToImage: (urlToImage && urlToImage.split("://")[0] === "http") ? `https://${urlToImage.split("://")[1]}` : urlToImage,
                                publishedAt: publishedAt,
                                comments: [],
                                cluster: countryCode,
                                custom: false,
                                id: new mongoose.Types.ObjectId()
                            });

                            article.save().catch(() => {return null});
                        });
                    })
                    .catch(() => {return null});
            })
        })
        .then(() => res.status(200).json("ok"))
        .catch(err => res.status(500).json(err));
});


io.on('connection', function(socket){
    socket.on('post comment', ({id, author, content, publishedAt}) => {
        const comment = {
            id: new mongoose.Types.ObjectId(),
            author, comment: content, publishedAt
        };

        News.findOne({id})
            .then((response) => {
                News.updateOne({id}, {
                    comments: [comment, ...response.comments]
                })
                    .then(() => io.emit('post comment',{id, comment}))
                    .catch(err => io.emit('post comment',err));
            })
            .catch(err => io.emit('post comment',err));
    });

    socket.on('delete comment', ({articleId, commentId}) => {
        News.findOne({id: articleId})
            .then((response) => {
                News.updateOne({id: articleId}, {comments: response.comments.filter(({id})=> id !== commentId)})
                    .then(() => io.emit('delete comment', {commentId}))
                    .catch(err => io.emit('delete comment',err));
            })
            .catch(err => io.emit('delete comment',err));
    });

    // socket.on('disconnect', () =>{});
});

server.listen(port, () => console.log(`listening on port ${port}`));