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
const jwt = require('jsonwebtoken');
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
index.use('/', express.static(path.join(__dirname)));

mongoose.connect( uri, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true });

//rewrite all available images in mongo cloud after reload api
Image
    .find()
    .exec()
    .then(res => res.map(({name, img}) => fs.writeFile(`images/${name}`, img, function (err) {})));

if (fs.existsSync(path.join(__dirname, 'index.html'))){
    index.get(
        ['/', '/dashboard', '/login', '/signup', '/profile', '/admin', "/admin/users", "/admin/statistics"],
        (req, res) => res.sendFile(path.join(__dirname, 'index.html'))
    );
} else {
    index.get('/', (req, res) => {
        const availableRoutes = !_.isEmpty(index._router.stack)
            ? "<br> Available routes: <br>" + index._router.stack
                .filter(r => r.route)
                .map(r => r.route.path).join("<br>")
            : "";
        res.send(`Hello, it's a news-api ${availableRoutes}`)
    });
}

index.get('/news', (req, res) => {
    const cluster = JSON.parse(JSON.stringify(req.query.source));

    News.find({cluster: cluster})
        .exec()
        .then( response => res.status(200).json(response.reverse()))
        .catch(err => res.status(500).json(err));
});

index.route('/article')
    .post((req, res) => {
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


        if (imageFile) {
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
            .then(response => res.status(200).json(response))
            .catch(err => res.status(500).json(err));
    })
    .put((req, res) => {
        const editArticle = req.body;
        const id = JSON.parse(JSON.stringify(req.query.id));

        if (req.files && req.files.main_image) {
            const imageFile = req.files.main_image;

            editArticle.urlToImage = `${req.protocol}://${req.headers.host}/images/${imageFile.name}`;
            imageFile.mv(`${__dirname}/images/${imageFile.name}`);
        }

        News.updateOne({id}, {$set: {...editArticle}})
            .then(() => res.status(200).json({id, ...editArticle}))
            .catch(err => res.status(500).json(err));
    })
    .delete((req, res) => {
        const {id, type} = req.query;
        let cluster = JSON.parse(JSON.stringify(type));

        News.deleteOne({id, cluster: cluster})
            .exec()
            .then(() => res.status(200).json({id}))
            .catch((err) => res.status(404).json(err));
    });

index.get('/users', (req, res) => {
    User.find()
        .exec()
        .then( response => res.status(200).json(response))
        .catch(err => res.status(404).json(err));
});

index.post('/user', (req, res) => {
    const {password, ...rest} = req.body;

    const user = new User({
        ...rest,
        password: jwt.sign({password}, 'cryptoPassword'),
        id: new mongoose.Types.ObjectId()});

    user.save()
        .then( response => res.status(200).json(response))
        .catch(err => res.status(404).json(err));
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


index.post('/login', (req, res) => {
    const {email, password} = req.body;
    const innerPass = jwtDecode(password).password;

    User.findOne({email})
        .exec()
        .then( response => {
            if(response && jwtDecode(response.password).password === innerPass){
                const { id, name, surname, email, birthday, phone, role} = response;
                const token = randtoken(16);

                tokens.push({"token": token, id});
                tokens = _.uniqBy(tokens, 'id');

                res.status(200).json({response: {id,  name, surname, email, birthday, phone, role}, token})
            }else {
                res.status(403).json("user not found")
            }
        })
        .catch(err => res.status(401).json(err));
});

index.get('/session',(req, res) => {
    if (tokens.length === 0 && req.query.token){
        res.json({
            error: true,
            status:"Failed",
            message:"Session not founds"
        })
    } else {
        const id = tokens.find(item => item.token === req.query.token).id;

        if(id){
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
        }else {
            res.json({
                error: true,
                status:"Failed",
                message:"Session not founds"
            })
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

index.route('/statistics')
    .get((req, res) => {
        Statistics.find()
            .exec()
            .then(response => res.status(200).json(response))
            .catch(err => res.status(404).json(err));
    })
    .post((req, res) => {
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

index.get('/update_news', (req, res) => {
    News.find({custom: false})
        .distinct('id')
        .exec()
        .then(response => {
            return News.deleteMany({id: {$in: response}})
                .then(res => res.deletedCount)
        })
        .then((response) => {
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
            });
            return response;
        })
        .then((response) => {
            res.status(200).json({
                text: "Updated",
                status: "Success",
                info: {
                    deletedCounts: response,
                }
            })
        })
        .catch(err => {
            res.status(200).json({
                text: "Not updated",
                status: "Failed",
                info: err
            })
        });
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

index.use((req, res) => res.status(404).sendFile(path.join(__dirname, "404", '404.html')));
index.use((req, res) => res.status(500).sendFile(path.join(__dirname, "500", '500.html')));

server.listen(port, () => console.log(`listening on port ${port}`));