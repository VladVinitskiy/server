const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ImageSchema = new Schema({
    img: Buffer,
    name: String,
    id: mongoose.Schema.Types.ObjectId
});

const Image = mongoose.model("image", ImageSchema);

module.exports = Image;