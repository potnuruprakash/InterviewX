/**
 * AI Service Resource & Limit Verification (Section 6)
 */
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const SECRET = process.env.AI_SERVICE_SECRET_KEY || 'ix_sec_key_e37b901a8f4c2e';

async function testAIServiceLimits() {
  console.log('--- Testing AI Service Resource Limits ---');
  const client = axios.create({
    baseURL: AI_URL,
    headers: { 'X-Internal-Service-Key': SECRET },
    validateStatus: () => true,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  // 1. Empty audio file
  const formEmpty = new FormData();
  formEmpty.append('audio', Buffer.alloc(0), { filename: 'empty.wav', contentType: 'audio/wav' });
  const resEmpty = await client.post('/api/ai/audio-analyze', formEmpty, {
    headers: formEmpty.getHeaders(),
  });
  console.log(`Empty audio response: ${resEmpty.status}`);
  const passEmpty = resEmpty.status === 400 || resEmpty.status === 422;
  console.log(`  Empty audio rejection: ${passEmpty ? '✅ PASS' : '❌ FAIL'}`);

  // 2. Corrupted audio file
  const formCorrupt = new FormData();
  formCorrupt.append('audio', Buffer.from('NOT_A_VALID_AUDIO_HEADER_DATA_12345'), { filename: 'corrupted.wav', contentType: 'audio/wav' });
  const resCorrupt = await client.post('/api/ai/audio-analyze', formCorrupt, {
    headers: formCorrupt.getHeaders(),
  });
  console.log(`Corrupted audio response: ${resCorrupt.status}`, resCorrupt.data);
  const passCorrupt = resCorrupt.status === 400 || (resCorrupt.status === 200 && (resCorrupt.data?.audioFeaturesAvailable === false || resCorrupt.data?.data?.audioFeaturesAvailable === false || resCorrupt.data?.success === false));
  console.log(`  Corrupted audio handled gracefully without crashing or fake scores: ${passCorrupt ? '✅ PASS' : '❌ FAIL'}`);

  // 3. Oversized audio (> 50MB)
  // We stream a 51MB chunked buffer to test 413 payload limit
  const largeBuf = Buffer.alloc(52 * 1024 * 1024, 0xAA);
  const formLarge = new FormData();
  formLarge.append('audio', largeBuf, { filename: 'large.wav', contentType: 'audio/wav' });
  const resLarge = await client.post('/api/ai/audio-analyze', formLarge, {
    headers: formLarge.getHeaders(),
  });
  console.log(`Oversized audio response: ${resLarge.status}`);
  const passLarge = resLarge.status === 413;
  console.log(`  Oversized audio rejected with 413 Payload Too Large: ${passLarge ? '✅ PASS' : '❌ FAIL'}`);

  console.log('--- AI Service Resource Limits Complete ---');
}

testAIServiceLimits().catch(console.error);
