const express = require('express');
const index = express();
const axios = require('axios');
const bodyPareser = require('body-parser');
const cors = require('cors');
const _ = require("lodash");
const randtoken = require('rand-token').suid;
const fileUpload = require('express-fileupload');

const NEWS_API = 'https://newsapi.org/v2';
const source = 'top-headlines?country=';
const global = 'everything?domains=wsj.com';
const KEY = '19c35e4ad3b54f4faae2dfc9b75ea8f7';

const port = process.env.PORT || '5000';

let users = [
    {
        "name": "Vlad",
        "surname":"Kalitsinskiy",
        "email": "kalit@gmail.com",
        "birthday":"2000-09-18",
        "password": "password",
        "phone": "380933312313",
        "id": `f${(~~(Math.random()*1e8)).toString(16)}`,
        "role":"admin"
    },
    {
        "name": "USERADMIN",
        "surname":"Adm",
        "email": "USERADMIN@com.ua",
        "birthday":"2000-09-21",
        "password": "password",
        "phone": "380977777777",
        "id": `f${(~~(Math.random()*1e8)).toString(16)}`,
        "role":"admin"
    },
];
let news = {
    "global":[]
};

let tokens=[];


index.use(bodyPareser.json());
index.use(bodyPareser.urlencoded({extended: true}));
index.use(cors());
index.use(fileUpload());
index.use('/images', express.static(__dirname + '/images'));

index.get('/news', (req, res) => {
    const countryCode = req.query.source ? req.query.source : "global";
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
                    source:source.name,
                    url:url,
                    "urlToImage": (urlToImage && urlToImage.split("://")[0] === "http") ? `https://${urlToImage.split("://")[1]}` : urlToImage,
                    publishedAt:publishedAt,
                    comments: [],
                    status: false,
                    id: `f${(~~(Math.random()*1e8)).toString(16)}`
                }
            });
        })
        .then(data => {
            news[cluster] = _.unionBy(news[cluster], data, "publishedAt");
            res.send(news[cluster]);
        })
        .catch(error => {
            console.log(error);
        });
});

index.get('/users', (req, res) => {
    res.send(users);
});

index.post('/user', (req, res) => {
    let id = `f${(~~(Math.random()*1e8)).toString(16)}`;
    users.push({id, ...req.body});

    res.send(req.body);
    console.log(`SIGN UP ${req.body.name}`);
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
        res.send("Not found");
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

index.listen(port, () => console.log(`listening on port ${port}`));