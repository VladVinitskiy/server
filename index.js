const express = require('express');
const index = express();
const axios = require('axios');
const bodyPareser = require('body-parser');
const cors = require('cors');

const NEWS_API = 'https://newsapi.org/v2';
const ukrainian = 'top-headlines?country=ua';
const everything = 'everything?domains=wsj.com';
const KEY = '19c35e4ad3b54f4faae2dfc9b75ea8f7';
const port = process.env.PORT || '5000';

let users = [
    {"name": "Vlad", "surname":"Kalitsinskiy", "email": "kalit@gmail.com", birthday:"2000-09-18", "password": "password", "phone": "380933312313"},
    {"name": "USERADMIN", "surname":"Important gui", "email": "USERADMIN@com.ua", birthday:"2000-09-21", "password": "Testing1", "phone": "380977777777"},
];
let news = [];
let session;

index.use(bodyPareser.json());
index.use(bodyPareser.urlencoded({extended: true}));
index.use(cors());

index.get('/news', (req, res) => {
    axios.get(`${NEWS_API}/${req.query.type === "ukrainian" ? ukrainian : everything}&apiKey=${KEY}`)
        .then(response => {
            return response.data.articles
        })
        .then(data => {
            return data.map(({author, source, title, description, url, urlToImage, publishedAt}) => {
                return {
                    author: author,
                    title: title,
                    description: description,
                    source:source.name,
                    url:url,
                    urlToImage:urlToImage,
                    publishedAt:publishedAt,
                    comments: [],
                    status: false,
                    like: Math.round(5 + Math.random() * (100 - 5)),
                    id: `f${(~~(Math.random()*1e8)).toString(16)}`
                }
            });
        })
        .then(data => {
            news = [...data];
            res.send(news);
        })
        .catch(error => {
            console.log(error);
        });
});

index.get('/users', (req, res) => {
    res.send(users);
});

index.post('/user', (req, res) => {
    users.push({...req.body});
    res.send(req.body);
    console.log(`SIGN UP ${req.body.name}`);
});

index.post('/news', (req, res) => {
    news.unshift({...req.body});
    res.send(req.body);
});


index.post('/login', (req, res) => {
    const {email, password} = req.body;

    users.map((user)=>{
        if(user.email === email && user.password === password){
            const {password, ...response} = user;
            session = response;
            res.send(response);
        }else {
            res.send("Not found");
        }
    });
});

index.get('/me',(req, res) => {
    if (session){
        res.send(session)
    } else {
        res.send(false);
    }
});

index.get('/logout',(req, res) => {
    if (session) {
        res.send(true);
        session = "";
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
index.put('/users/:name', (req, res) => {
    let user = users.find((user) => {
        return user.name === req.params.name
    });
    user.email = req.body.email;
    user.password = req.body.password;
    user.phone = req.body.phone;
    res.sendStatus(200);
    console.log('CHANGE DATA BY ' + req.params.name.toUpperCase());
});

//delete data
index.delete('/users/:name', (req, res) => {
    users = users.filter((user) => {
        return user.name !== req.params.name;
    });
    res.sendStatus(200);
    console.log('DELETE USER ' + req.params.name.toUpperCase());
});


index.listen(port, () => console.log(`listening on port ${port}`));