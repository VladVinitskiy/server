const express = require('express');
// const MongoClient = require('mongodb').MongoClient;
const bodyPareser = require('body-parser');
const app = express();
// let db;
const port = '5000';
const news = [
    {
        "author": "Tom Calver",
        "text": "Manufacturers seek end to ‘damaging short-term decisions’",
        "bigText": "Manufacturers are calling on Theresa May to revoke article 50 if she can’t strike a Brexit agreement next week, in the latest sign that the looming possibility of Britain leaving the EU without a deal is hammering confidence in the sector.\n\nMake UK, the lobby group that represents 20,000 manufacturing firms, last night wrote to May and Jeremy Corbyn, the Labour leader, saying it is “critical for the future of UK manufacturing businesses and their workforces that we bring the current uncertainty to an end”",
        "comment": "",
        "like": 243,
        "more": false,
        "status": false
    },
    {
        "author": "Andrew Ellson",
        "text": "Estate agents dupe sellers",
        "bigText": "Estate agent chains are overvaluing properties by up to a fifth in a practice that can mislead sellers into paying higher rates of commission, an investigation by The Times has found.\n\nAnalysis of more than 200,000 properties listed online reveals that overvaluations are rife, with the biggest agents the worst offenders.\n\nThe data suggests that agents with the highest commissions are over-valuing properties the most to attract homeowners. The properties then sell at lower prices, but the agents take big fees. Nearly two thirds of homes listed by Foxtons, the biggest agent in London, have to be reduced from their initial price before they can be sold, almost double the national average.",
        "comment": "",
        "like": 213,
        "more": false,
        "status": false
    },
    {
        "author": "Sam Joiner",
        "text": "Army chief dresses down troops in YouTube rebuke",
        "bigText": "The head of the army has issued an unprecedented rebuke to his colleagues at the end of a week that saw six soldiers accused of serious sexual assault and a leaked video showed paratroopers using a picture of Jeremy Corbyn for target practice.\n\nInvoking the memory of comrades killed on the battlefield, General Sir Mark Carleton-Smith, chief of the general staff, said the allegations had “damaged” the army’s reputation, which he said was “exceptionally hard-earned”.\n\nIn an extraordinary three-minute video posted on YouTube, Britain’s leading soldier said the allegations against some of his men were “downright unacceptable” for a service that bore a “unique responsibility on behalf of the nation”.",
        "comment": "",
        "like": 2332,
        "more": false,
        "status": false
    },
    {
        "author": "David Walsh",
        "text": "Tiger Roll matches Red Rum with back-to-back Grand National wins",
        "bigText": "The biggest cheer of all was reserved for the horse. Tiger Roll, one of the smallest thoroughbreds to tackle the biggest fences in steeplechasing, came striding into the winners’ enclosure to an ovation worthy of a once-in-a-lifetime champion. For such a little horse to win the National once seemed a fairytale but to do it again 12 months later was to sail into that racing paradise where only Red Rum is to be found.\n\nThe owner Michael O’Leary has built Ryanair from close to nothing into one of the world’s leading airlines.",
        "comment": "",
        "like": 231,
        "more": false,
        "status": false
    }
];
let users = [{"name": "Vlad", "email": "kalit@com.ua", "password": "1111", "phone": "380933312313"}];

app.use(bodyPareser.json());
app.use(bodyPareser.urlencoded({extended: true}));

let cors = require('cors');
app.use(cors());

app.get('/news',cors(), (req, res) => {
    res.send(news);
    console.log(req.url);
});

app.get('/users',cors(), (req, res) => {
    res.send(users);
    console.log(req.url);
});

app.post('/users',cors(), (req, res) => {
    users.push({...req.body});
    res.send(req.body);
});

app.post('/news',cors(), (req, res) => {
    news.push({...req.body});
    res.send(req.body);
});

//update data
app.put('/users/:name',cors(),(req,res)=>{
    let user = users.find((user)=> {
        return user.name === req.params.name
    });
    user.email=req.body.email;
    user.password=req.body.password;
    user.phone=req.body.phone;
    res.sendStatus(200);
});

//delete data
app.delete('/users/:name',cors(),(req,res)=>{
    users = users.filter((user)=>{
        return user.name !== req.params.name;
    });
    res.sendStatus(200);
});


app.listen(port, () => console.log(`Example app listening on port ${port}!`));

