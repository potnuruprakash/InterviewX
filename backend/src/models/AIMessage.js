const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    size: { type: Number, default: 0 },
    mimeType: { type: String, default: 'application/octet-stream' },
    fileUrl: { type: String, default: null },
    extractedSnippet: { type: String, default: null },
  },
  { _id: false }
);

const aiMessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AIConversation',
      required: true,
      index: true,
    },
    clerkUserId: {
      type: String,
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['system', 'assistant', 'user'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    feedback: {
      type: String,
      enum: ['like', 'dislike', null],
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      // Contains intent, suggestions, evaluation details, follow-ups, plan items
    },
  },
  { timestamps: true }
);

aiMessageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model('AIMessage', aiMessageSchema);
