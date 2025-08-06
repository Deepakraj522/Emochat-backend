const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'emoji', 'voice'],
    default: 'text'
  },
  chatRoom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatRoom',
    required: true
  },
  emotion: {
    detected: {
      type: String,
      enum: ['joy', 'sadness', 'anger', 'fear', 'surprise', 'disgust', 'neutral'],
      default: 'neutral'
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },
    sentiment: {
      score: {
        type: Number,
        min: -1,
        max: 1,
        default: 0
      },
      magnitude: {
        type: Number,
        min: 0,
        default: 0
      }
    },
    processedBy: {
      type: String,
      enum: ['google-nlp', 'local-analysis', 'manual'],
      default: 'local-analysis'
    },
    processingTime: {
      type: Number,
      default: 0
    }
  },
  metadata: {
    isRead: {
      type: Boolean,
      default: false
    },
    readAt: {
      type: Date,
      default: null
    },
    isEdited: {
      type: Boolean,
      default: false
    },
    editedAt: {
      type: Date,
      default: null
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date,
      default: null
    },
    deliveryStatus: {
      type: String,
      enum: ['sent', 'delivered', 'read', 'failed'],
      default: 'sent'
    }
  },
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'file', 'voice']
    },
    url: String,
    filename: String,
    size: Number,
    mimeType: String
  }],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
messageSchema.index({ chatRoom: 1, createdAt: -1 });
messageSchema.index({ sender: 1, receiver: 1 });
messageSchema.index({ 'metadata.isRead': 1 });

// Mark message as read
messageSchema.methods.markAsRead = function() {
  this.metadata.isRead = true;
  this.metadata.readAt = new Date();
  this.metadata.deliveryStatus = 'read';
  return this.save();
};

// Soft delete message
messageSchema.methods.softDelete = function() {
  this.metadata.isDeleted = true;
  this.metadata.deletedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Message', messageSchema);
