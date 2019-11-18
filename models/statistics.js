const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Statschema = new Schema({
    ip: {
        type: String
    },
    country: {
        type: String
    },
    city: {
        type: String
    },
    timezone: {
        type: String
    },
    ll: {
        type: Array
    },
    range: {
        type: Array
    },
    visitedAt: {
        type: Date
    },
    id: mongoose.Schema.Types.ObjectId
});

const Statistics = mongoose.model("statistics", Statschema);

module.exports = Statistics;