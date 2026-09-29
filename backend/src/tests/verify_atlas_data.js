const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const Resume = require('../models/Resume');
const JobDescription = require('../models/JobDescription');
const SkillAnalysis = require('../models/SkillAnalysis');
const Interview = require('../models/Interview');
const Response = require('../models/Response');
const TrainingSession = require('../models/TrainingSession');
const AIConversation = require('../models/AIConversation');

async function verifyData() {
  console.log('====================================================');
  console.log('  InterviewX: MongoDB Atlas Data Verification');
  console.log('====================================================\n');

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  console.log('Target URI Host Check:');
  const match = uri.match(/@([^/?]+)/);
  console.log('Host from URI:', match ? match[1] : 'Unknown');

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });

  console.log('\nActual Mongoose Connection:');
  console.log('  Connected Host:', mongoose.connection.host);
  console.log('  Database Name :', mongoose.connection.name);
  console.log('  Ready State   :', mongoose.connection.readyState === 1 ? 'CONNECTED (1)' : mongoose.connection.readyState);
  console.log('----------------------------------------------------');

  const results = {};

  // 1. Resume
  const resumeCount = await Resume.countDocuments();
  const sampleResume = await Resume.findOne().lean();
  results.Resume = {
    count: resumeCount,
    sampleId: sampleResume ? sampleResume._id.toString() : 'None',
    sampleUser: sampleResume ? sampleResume.clerkUserId : 'None',
    hasData: resumeCount > 0,
  };

  // 2. JobDescription
  const jdCount = await JobDescription.countDocuments();
  const sampleJd = await JobDescription.findOne().lean();
  results.JobDescription = {
    count: jdCount,
    sampleId: sampleJd ? sampleJd._id.toString() : 'None',
    sampleTitle: sampleJd ? sampleJd.title : 'None',
    hasData: jdCount > 0,
  };

  // 3. SkillAnalysis
  const skillCount = await SkillAnalysis.countDocuments();
  const sampleSkill = await SkillAnalysis.findOne().lean();
  results.SkillAnalysis = {
    count: skillCount,
    sampleId: sampleSkill ? sampleSkill._id.toString() : 'None',
    sampleMatchScore: sampleSkill ? sampleSkill.overallMatchPercentage : 'None',
    hasData: skillCount > 0,
  };

  // 4. Interview
  const interviewCount = await Interview.countDocuments();
  const sampleInterview = await Interview.findOne().lean();
  results.Interview = {
    count: interviewCount,
    sampleId: sampleInterview ? sampleInterview._id.toString() : 'None',
    sampleStatus: sampleInterview ? sampleInterview.status : 'None',
    hasData: interviewCount > 0,
  };

  // 5. Response
  const responseCount = await Response.countDocuments();
  const sampleResponse = await Response.findOne().lean();
  results.Response = {
    count: responseCount,
    sampleId: sampleResponse ? sampleResponse._id.toString() : 'None',
    sampleScore: sampleResponse ? sampleResponse.finalScore : 'None',
    hasData: responseCount > 0,
  };

  // 6. TrainingSession
  const trainingCount = await TrainingSession.countDocuments();
  const sampleTraining = await TrainingSession.findOne().lean();
  results.TrainingSession = {
    count: trainingCount,
    sampleId: sampleTraining ? sampleTraining._id.toString() : 'None',
    sampleTopic: sampleTraining ? sampleTraining.topic : 'None',
    hasData: trainingCount > 0,
  };

  // 7. AIConversation
  const aiConvCount = await AIConversation.countDocuments();
  const sampleConv = await AIConversation.findOne().lean();
  results.AIConversation = {
    count: aiConvCount,
    sampleId: sampleConv ? sampleConv._id.toString() : 'None',
    sampleGoal: sampleConv ? sampleConv.goal : 'None',
    hasData: aiConvCount > 0,
  };

  console.table(
    Object.entries(results).map(([model, data]) => ({
      Model: model,
      'Document Count': data.count,
      'Sample Record': data.sampleId,
      'Status': data.hasData ? 'VERIFIED (Read OK)' : 'EMPTY',
    }))
  );

  console.log('====================================================');
  console.log('All 7 requested models verified against Atlas!');
  await mongoose.disconnect();
}

verifyData().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
