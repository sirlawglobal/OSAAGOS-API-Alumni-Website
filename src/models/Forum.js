const mongoose = require('mongoose');

const forumSchema = mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    posts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Forum = mongoose.model('Forum', forumSchema);

module.exports = Forum;
