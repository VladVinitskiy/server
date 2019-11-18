const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ArticleSchema = new Schema({
    author: {
        type: String,
        default: ""
    },
    title: {
        type: String,
        default: ""
    },
    description: {
        type: String,
        default: ""
    },
    source: {
        type: String,
        default: ""
    },
    url: {
        type: String,
        default: ""
    },
    urlToImage: {
        type: String,
        default: ""
    },
    publishedAt: {
        type: String,
        default: ""
    },
    comments: {
        type: Array,
        default: []
    },
    cluster: {
        type: String
    },
    custom: {
        type: Boolean,
        default: false
    },
    id: mongoose.Schema.Types.ObjectId
});

const News = mongoose.model("news", ArticleSchema);

module.exports = News;