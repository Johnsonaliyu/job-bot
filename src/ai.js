/**
 * AI module — Groq primary, Nvidia fallback.
 * Analyses a message and returns structured job-post data.
 */
const axios = require('axios');

const GROQ_API_URL   = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `You are a job application assistant. Analyse WhatsApp messages to determine if they are job postings.

If the message IS a job posting, respond with ONLY a JSON object (no markdown):
{
  "isJobPosting": true,
  "email": "recruiter@company.com",   // application/recruiter email; null if none found
  "jobTitle": "Job Title",
  "company": "Company Name",          // null if not mentioned
  "jobCategory": "tech|sales|admin|other",
  "summary": "One-line summary of the role"
}

Job category rules:
- "tech"  : software developer, IT, data analyst, engineer, programmer, DevOps, cybersecurity, web/mobile developer, network/system engineer, data scientist, AI/ML, technical product manager
- "sales" : sales executive/manager/rep, marketing, digital marketing, business development, brand manager; also graduate-trainee roles that are sales/marketing-oriented
- "admin" : administrative/virtual/executive assistant, office manager, secretary, receptionist, data entry, customer service, operations; also general or administrative graduate-trainee roles
- "other" : everything else

If the message is NOT a job posting, respond with ONLY:
{"isJobPosting": false}

Respond with ONLY valid JSON — no extra text, no markdown fences.`;

// ── Groq ──────────────────────────────────────────────────────────────────────
async function callGroq(text) {
  const res = await axios.post(
    GROQ_API_URL,
    {
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: text }
      ],
      temperature: 0.1,
      max_tokens: 400,
      response_format: { type: 'json_object' }
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    }
  );
  return JSON.parse(res.data.choices[0].message.content);
}

// ── Nvidia ────────────────────────────────────────────────────────────────────
async function callNvidia(text) {
  const baseUrl = (process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1')
    .replace(/\/$/, '');

  const res = await axios.post(
    `${baseUrl}/chat/completions`,
    {
      model: process.env.NVIDIA_MODEL || 'meta/llama-3.1-70b-instruct',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: text }
      ],
      temperature: 0.1,
      max_tokens: 400
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 25000
    }
  );

  const content = res.data.choices[0].message.content;
  const match   = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in Nvidia response');
  return JSON.parse(match[0]);
}

// ── Public API ────────────────────────────────────────────────────────────────
async function analyzeMessage(text) {
  try {
    return await callGroq(text);
  } catch (err) {
    console.log(`⚠️  Groq failed (${err.message}) — trying Nvidia…`);
  }
  try {
    return await callNvidia(text);
  } catch (err) {
    console.error(`❌ Nvidia also failed: ${err.message}`);
    return { isJobPosting: false };
  }
}

module.exports = { analyzeMessage };
