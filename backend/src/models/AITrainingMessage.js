const mongoose = require('mongoose');

const aiTrainingMessageSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AITrainingSession',
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
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      // Structured evaluation: {
      //   evaluation: { correct: [], missing: [], concept: '', hint: '', score: 0 },
      //   nextQuestion: '',
      //   difficulty: '',
      //   topic: '',
      //   quickActions: []
      // }
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AITrainingMessage', aiTrainingMessageSchema);
