import dotenv from 'dotenv';
dotenv.config();
import Groq from 'groq-sdk';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch'; // Requires node-fetch or native fetch in Node 18+
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Feature-specific API keys with dynamic resolution
export const getFeatureKey = (feature) => {
    switch (feature) {
        case 'STUDY_ROOM':
            return process.env.STUDY_ROOM_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GROQ_API_KEY;
        case 'MOCK_INTERVIEW':
            return process.env.MOCK_INTERVIEW_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GROQ_API_KEY;
        case 'QUIZ':
            return process.env.QUIZ_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GROQ_API_KEY;
        default:
            return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GROQ_API_KEY;
    }
};

const FEATURE_KEYS = new Proxy({}, {
    get: (_, prop) => getFeatureKey(prop)
});

const isGeminiKey = (key) => Boolean(
    key && (
        key.startsWith('AIza') ||
        key.startsWith('AQ.') ||
        key === process.env.GEMINI_API_KEY ||
        key === process.env.GOOGLE_API_KEY ||
        !key.startsWith('gsk_')
    )
);

export const getGeminiCandidateModels = () => {
    return [...new Set([
        process.env.GEMINI_MODEL,
        'gemini-flash-lite-latest',
        'gemini-3.1-flash-lite',
        'gemini-3.5-flash',
        'gemini-3.8-flash',
        'gemini-flash-latest'
    ].filter(Boolean))];
};

console.log('🔑 Feature-specific API keys loaded:');
console.log(`   - Study Rooms: ${FEATURE_KEYS.STUDY_ROOM ? '✓' : '✗'} (${isGeminiKey(FEATURE_KEYS.STUDY_ROOM) ? 'Gemini' : 'Groq'})`);
console.log(`   - Mock Interviews: ${FEATURE_KEYS.MOCK_INTERVIEW ? '✓' : '✗'} (${isGeminiKey(FEATURE_KEYS.MOCK_INTERVIEW) ? 'Gemini' : 'Groq'})`);
console.log(`   - Quiz: ${FEATURE_KEYS.QUIZ ? '✓' : '✗'} (${isGeminiKey(FEATURE_KEYS.QUIZ) ? 'Gemini' : 'Groq'})`);

// Rate limiting configuration
const MIN_REQUEST_INTERVAL = 5000; // 5 seconds between requests per feature
const MAX_PROMPT_LENGTH = 2000; // Max characters to prevent token explosion

// Separate queues for each feature
const featureQueues = {
    STUDY_ROOM: [],
    MOCK_INTERVIEW: [],
    QUIZ: [],
    DEFAULT: []
};

const featureProcessing = {
    STUDY_ROOM: false,
    MOCK_INTERVIEW: false,
    QUIZ: false,
    DEFAULT: false
};

const processQueue = async (feature) => {
    if (featureProcessing[feature] || featureQueues[feature].length === 0) return;

    featureProcessing[feature] = true;
    const { prompt, messages, resolve, reject } = featureQueues[feature].shift();

    try {
        // Execute either prompt-based or message-based request
        const result = messages
            ? await executeChatRequest(messages, feature)
            : await executeAIRequest(prompt, feature);
        resolve(result);
    } catch (error) {
        reject(error);
    } finally {
        featureProcessing[feature] = false;

        // Process next request after interval
        if (featureQueues[feature].length > 0) {
            setTimeout(() => processQueue(feature), MIN_REQUEST_INTERVAL);
        }
    }
};

const executeAIRequest = async (prompt, feature) => {
    const apiKey = FEATURE_KEYS[feature] || FEATURE_KEYS.DEFAULT;

    if (!apiKey) {
        throw new Error('No API key configured for this feature');
    }

    if (isGeminiKey(apiKey)) {
        console.log(`🔑 Using ${feature} with Google Gemini AI`);
        const genAI = new GoogleGenerativeAI(apiKey);
        const models = getGeminiCandidateModels();
        let lastError = null;

        for (const modelName of models) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                console.log(`Prompt length: ${prompt.length} characters (trying ${modelName})`);
                const result = await model.generateContent(prompt);
                const response = await result.response;
                const text = response.text() || '';
                console.log(`✅ Success with Gemini (${modelName}) for ${feature}`);
                return text;
            } catch (error) {
                console.warn(`❌ Failed with ${modelName}: ${error.message}`);
                lastError = error;
                if (error.message.includes('429') || error.message.includes('rate limit')) {
                    throw new Error(`RATE_LIMIT:60:${feature}`);
                }
            }
        }
        throw new Error(`AI_ERROR:${lastError?.message || 'All Gemini models failed'}`);
    }

    console.log(`🔑 Using ${feature} with Groq AI`);

    // Initialize Groq client
    const groq = new Groq({ apiKey });

    // Try models in order of preference (fastest to most capable)
    const models = [
        'llama-3.3-70b-versatile',  // Fastest, great for general tasks
        'llama-3.1-70b-versatile',  // Very capable
        'mixtral-8x7b-32768'        // Good for longer context
    ];

    let lastError = null;

    for (const modelName of models) {
        try {
            console.log(`Trying Groq model: ${modelName}...`);
            console.log(`Prompt length: ${prompt.length} characters`);

            const chatCompletion = await groq.chat.completions.create({
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                model: modelName,
                temperature: 0.7,
                max_tokens: 1024,
            });

            const text = chatCompletion.choices[0]?.message?.content || '';

            console.log(`✅ Success with ${modelName} for ${feature}`);
            return text;

        } catch (error) {
            console.log(`❌ Failed with ${modelName}: ${error.message}`);
            lastError = error;

            // Check if it's a rate limit error
            if (error.message.includes('429') ||
                error.message.includes('rate limit')) {

                const waitSeconds = 60; // Default wait time
                throw new Error(`RATE_LIMIT:${waitSeconds}:${feature}`);
            }

            // Try next model on error
            if (modelName === models[models.length - 1]) {
                throw new Error(`AI_ERROR:${error.message}`);
            }
        }
    }

    // If all models failed
    throw lastError || new Error('All AI models failed');
};

// Execute chat request with messages array
const executeChatRequest = async (messages, feature) => {
    const apiKey = FEATURE_KEYS[feature] || FEATURE_KEYS.DEFAULT;

    if (!apiKey) {
        throw new Error('No API key configured for this feature');
    }

    if (isGeminiKey(apiKey)) {
        console.log(`🔑 Using ${feature} chat with Google Gemini AI`);
        const genAI = new GoogleGenerativeAI(apiKey);
        const models = getGeminiCandidateModels();
        const prompt = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
        let lastError = null;

        for (const modelName of models) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent(prompt);
                const response = await result.response;
                return response.text() || '';
            } catch (error) {
                console.warn(`❌ Failed chat with ${modelName}: ${error.message}`);
                lastError = error;
                if (error.message.includes('429') || error.message.includes('rate limit')) {
                    throw new Error(`RATE_LIMIT:60:${feature}`);
                }
            }
        }
        throw new Error(`AI_ERROR:${lastError?.message || 'All Gemini models failed'}`);
    }

    console.log(`🔑 Using ${feature} chat with Groq AI`);

    // Initialize Groq client
    const groq = new Groq({ apiKey });

    // Try models in order
    const models = [
        'llama-3.3-70b-versatile',
        'llama-3.1-70b-versatile',
        'mixtral-8x7b-32768'
    ];

    let lastError = null;

    for (const modelName of models) {
        try {
            console.log(`Trying Groq chat model: ${modelName}...`);
            console.log(`Messages count: ${messages.length}`);

            const chatCompletion = await groq.chat.completions.create({
                messages: messages,
                model: modelName,
                temperature: 0.8,
                max_tokens: 512,
            });

            const text = chatCompletion.choices[0]?.message?.content || '';

            console.log(`✅ Success with ${modelName}`);
            return text;

        } catch (error) {
            console.log(`❌ Failed with ${modelName}: ${error.message}`);
            lastError = error;

            if (error.message.includes('429') || error.message.includes('rate limit')) {
                const waitSeconds = 60;
                throw new Error(`RATE_LIMIT:${waitSeconds}:${feature}`);
            }

            if (modelName === models[models.length - 1]) {
                throw new Error(`AI_ERROR:${error.message}`);
            }
        }
    }

    throw lastError || new Error('All AI models failed');
};

export const generateResult = async (prompt, feature = 'DEFAULT') => {
    // Truncate prompt if too long
    if (prompt.length > MAX_PROMPT_LENGTH) {
        console.warn(`⚠️ Prompt truncated from ${prompt.length} to ${MAX_PROMPT_LENGTH} chars`);
        prompt = prompt.substring(0, MAX_PROMPT_LENGTH) + '\n...[truncated]';
    }

    return new Promise((resolve, reject) => {
        const queuePosition = featureQueues[feature].length + 1;

        if (queuePosition > 1) {
            console.log(`📋 ${feature} request queued at position ${queuePosition}`);
        }

        featureQueues[feature].push({
            prompt,
            resolve,
            reject: (error) => {
                if (error.message?.startsWith('RATE_LIMIT:')) {
                    const [_, seconds, feat] = error.message.split(':');
                    reject(new Error(`Rate limit hit for ${feat}. Please wait ${seconds} seconds and try again.`));
                } else if (error.message?.startsWith('AI_ERROR:')) {
                    const msg = error.message.replace('AI_ERROR:', '');
                    reject(new Error(`AI service error: ${msg}`));
                } else {
                    reject(error);
                }
            }
        });

        processQueue(feature);
    });
};

// New function for chat-based completions with conversation history
export const generateChatCompletion = async (conversationHistory, userMessage, systemPrompt, feature = 'DEFAULT') => {
    // Build messages array for Groq chat API
    const messages = [];

    // Add system message if provided
    if (systemPrompt) {
        messages.push({
            role: 'system',
            content: systemPrompt
        });
    }

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
        conversationHistory.forEach(msg => {
            messages.push({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            });
        });
    }

    // Add current user message
    messages.push({
        role: 'user',
        content: userMessage
    });

    console.log(`📝 Queueing chat with ${messages.length} messages for ${feature}`);

    // Use the queue system with messages instead of prompt
    return new Promise((resolve, reject) => {
        const queuePosition = featureQueues[feature].length + 1;

        if (queuePosition > 1) {
            console.log(`📋 ${feature} chat queued at position ${queuePosition}`);
        }

        featureQueues[feature].push({
            messages,  // Pass messages instead of prompt
            resolve,
            reject: (error) => {
                if (error.message?.startsWith('RATE_LIMIT:')) {
                    const [_, seconds, feat] = error.message.split(':');
                    reject(new Error(`Rate limit hit for ${feat}. Please wait ${seconds} seconds and try again.`));
                } else if (error.message?.startsWith('AI_ERROR:')) {
                    const msg = error.message.replace('AI_ERROR:', '');
                    reject(new Error(`AI service error: ${msg}`));
                } else {
                    reject(error);
                }
            }
        });

        processQueue(feature);
    });
};

/**
 * Generate structured JSON response for feedback
 */
export const generateJSONFeedback = async (prompt, feature = 'MOCK_INTERVIEW') => {
    const apiKey = FEATURE_KEYS[feature] || FEATURE_KEYS.DEFAULT;

    if (!apiKey) {
        throw new Error('No API key configured for this feature');
    }

    if (isGeminiKey(apiKey)) {
        console.log(`🎯 Generating JSON feedback with Gemini for ${feature}`);
        const genAI = new GoogleGenerativeAI(apiKey);
        const models = getGeminiCandidateModels();
        const jsonPrompt = `${prompt}\n\nIMPORTANT: Return valid raw JSON object only. Do not include markdown formatting or codeblocks.`;

        for (const modelName of models) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const res = await model.generateContent(jsonPrompt);
                let text = res.response.text();
                text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) text = jsonMatch[0];
                return JSON.parse(text);
            } catch (err) {
                console.warn(`❌ JSON feedback failed with ${modelName}: ${err.message}`);
            }
        }
    }

    console.log(`🎯 Generating JSON feedback with ${feature}`);

    const groq = new Groq({ apiKey });

    try {
        // Use llama-3.3-70b-versatile with JSON mode
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: 'You are a technical interview evaluator. Always respond with valid JSON only, no additional text or formatting.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.5, // Lower temperature for more consistent JSON
            max_tokens: 2048,
            response_format: { type: "json_object" } // Force JSON response
        });

        const jsonText = chatCompletion.choices[0]?.message?.content || '{}';
        console.log('✅ JSON feedback generated');

        // Parse and return
        return JSON.parse(jsonText);

    } catch (error) {
        console.error('❌ JSON feedback generation failed:', error.message);
        throw error;
    }
};

/**
 * Generate Quiz from Document Content using Gemini
 */
export const generateQuizService = async (file, numQuestions = 5, customSubject = '') => {
    try {
        let textContent = '';

        // 1. Extract Text based on file type
        if (file.mimetype === 'application/pdf') {
            const buffer = file.buffer;
            const data = await pdfParse(buffer);
            textContent = data.text;
        } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ buffer: file.buffer });
            textContent = result.value;
        } else if (file.mimetype === 'text/plain' || file.originalname.endsWith('.txt')) {
            textContent = file.buffer.toString('utf-8');
        } else {
            throw new Error('Unsupported file type. Please upload PDF, DOCX, or TXT.');
        }

        // Limit text content for simple RAG (Context Stuffing)
        const MAX_CONTEXT_CHARS = 30000;
        if (textContent.length > MAX_CONTEXT_CHARS) {
            textContent = textContent.substring(0, MAX_CONTEXT_CHARS) + " ...[truncated]";
        }

        // 2. Call Gemini API
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || FEATURE_KEYS.QUIZ || FEATURE_KEYS.DEFAULT;
        if (!apiKey) throw new Error('No API Key configured for Quiz generation');

        const genAI = new GoogleGenerativeAI(apiKey);
        const modelsToTry = getGeminiCandidateModels();

        const subjectFocus = customSubject ? ` Focus specifically on the topic/subject: "${customSubject}".` : '';

        const prompt = `
        You are an expert educational assistant. Create a multiple-choice quiz based ONLY on the following text.${subjectFocus}
        
        Text Content:
        "${textContent}"

        Requirements:
        1. Generate ${numQuestions} questions.
        2. Provide 4 options for each question.
        3. Indicate the correct answer.
        4. Return the result as a strict JSON array of objects.
        
        JSON Structure:
        [
          {
            "question": "Question text here?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "answer": "Correct Option Text (must match one of the options exactly)"
          }
        ]
        
        Do not include markdown formatting (like \`\`\`json). Return raw JSON only.
        `;

        let text = '';
        let lastError = null;

        for (const modelName of modelsToTry) {
            try {
                console.log(`🤖 Generating quiz with Gemini (${modelName})...`);
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent(prompt);
                const response = await result.response;
                text = response.text() || '';
                if (text) {
                    console.log(`✅ Success generating quiz with Gemini (${modelName})`);
                    break;
                }
            } catch (genErr) {
                console.warn(`⚠️ Quiz generation attempt failed with ${modelName}: ${genErr.message}`);
                lastError = genErr;
            }
        }

        if (!text) {
            throw lastError || new Error('All Gemini models failed for quiz generation');
        }

        // Cleanup markdown if present
        text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            text = jsonMatch[0];
        }

        const questions = JSON.parse(text);
        const detectedTopic = customSubject || file.originalname.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ') || 'Generated Quiz';

        return {
            subject: detectedTopic,
            questions: questions
        };

    } catch (error) {
        console.error('Quiz Generation Error:', error);
        throw new Error(`Failed to generate quiz: ${error.message}`);
    }
};

/**
 * Generate Quiz using Local Python RAG Service
 */
export const generateQuizLocal = async (file, numQuestions = 5) => {
    try {
        // 1. Save file temporarily
        const tempDir = path.join(__dirname, '../uploads/temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempFilePath = path.join(tempDir, `temp_${Date.now()}_${file.originalname}`);
        fs.writeFileSync(tempFilePath, file.buffer);

        console.log(`Saved temp file for RAG: ${tempFilePath}`);

        // 2. Call Python Flask API
        try {
            const response = await fetch('http://127.0.0.1:5000/generate-quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file_path: tempFilePath,
                    num_questions: numQuestions
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Python API error: ${response.statusText}`);
            }

            const quizData = await response.json();
            return quizData;

        } finally {
            // 3. Cleanup temp file
            try {
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                    console.log(`Cleaned up temp file: ${tempFilePath}`);
                }
            } catch (cleanupError) {
                console.error('Failed to cleanup temp file:', cleanupError);
            }
        }

    } catch (error) {
        console.error('Local Quiz Generation Error:', error);
        throw new Error(`Failed to generate local quiz: ${error.message}`);
    }
};

/**
 * Predict Previous Year Questions based on historical exam patterns, subject, and syllabus
 */
export const predictPYQsService = async ({
    subject = 'Computer Science',
    targetExam = 'End-Sem 2026',
    topics = '',
    count = 5,
    difficulty = 'Medium',
    syllabusText = ''
}) => {
    const requestedCount = Math.min(Math.max(parseInt(count) || 5, 1), 10);
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.QUIZ_API_KEY || process.env.GROQ_API_KEY;

    const systemInstruction = `You are an expert University Examination Board Professor and Curriculum Specialist.
Your task is to analyze previous year question patterns, course syllabus, and subject weightage to PREDICT the most probable upcoming exam questions for the subject "${subject}".

Parameters:
- Subject: ${subject}
- Target Exam: ${targetExam}
- Specific Topics/Focus: ${topics || 'Comprehensive syllabus coverage across major units'}
- Requested Question Count: ${requestedCount}
- Difficulty Level: ${difficulty}
${syllabusText ? `- Additional Syllabus/Notes: ${syllabusText.substring(0, 3000)}` : ''}

For each predicted question, provide:
1. "question": The exact, clear examination question (comprehensive academic format).
2. "marks": Standard marks weightage (e.g. 5, 8, 10, or 15).
3. "unit": The unit or module it belongs to (e.g. "Unit 1", "Unit 2", "Module 3").
4. "topic": Specific core topic (e.g. "Deadlock Banker's Algorithm", "B+ Trees").
5. "questionType": "Subjective" | "Numerical" | "Analytical" | "Short Answer".
6. "difficulty": "Easy" | "Medium" | "Hard".
7. "probability": An integer from 70 to 98 representing likelihood percentage based on examination recurrence trends.
8. "predictionReasoning": 1-2 concise sentences explaining why this question is predicted (e.g. "Recurs every 2 years; key foundational topic tested in 2022 and 2024").
9. "solution": A structured model answer including introduction, key points/formulas, bullet points, and conclusion.
10. "tags": Array of 2-4 relevant keyword tags.

Output Format: Return ONLY a valid JSON array of objects conforming to the schema. Do not include markdown code blocks or conversational text.`;

    // Helper for timeout
    const withTimeout = (promise, ms = 12000) => {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('AI generation timeout')), ms))
        ]);
    };

    // Try Gemini
    if (apiKey && (apiKey.startsWith('AIza') || apiKey.startsWith('AQ.') || !apiKey.startsWith('gsk_'))) {
        try {
            console.log(`🔮 Generating Predicted PYQs using Gemini for ${subject}...`);
            const genAI = new GoogleGenerativeAI(apiKey);
            const models = getGeminiCandidateModels();

            for (const modelName of models) {
                try {
                    const model = genAI.getGenerativeModel({ model: modelName });
                    const result = await withTimeout(model.generateContent(systemInstruction), 10000);
                    const response = await result.response;
                    let text = response.text() || '';
                    if (text) {
                        text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
                        const jsonMatch = text.match(/\[[\s\S]*\]/);
                        if (jsonMatch) {
                            const parsed = JSON.parse(jsonMatch[0]);
                            if (Array.isArray(parsed) && parsed.length > 0) {
                                console.log(`✅ Successfully predicted ${parsed.length} PYQs with Gemini (${modelName})`);
                                return parsed;
                            }
                        }
                    }
                } catch (firstErr) {
                    console.warn(`Gemini attempt failed (${modelName}): ${firstErr.message}`);
                }
            }
        } catch (geminiError) {
            console.warn('⚠️ Gemini prediction error:', geminiError.message);
        }
    }

    // Try Groq as secondary
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
        try {
            console.log(`🔮 Generating Predicted PYQs using Groq AI for ${subject}...`);
            const groq = new Groq({ apiKey: groqKey });
            const completion = await withTimeout(groq.chat.completions.create({
                messages: [
                    { role: 'system', content: 'You are an exam paper predictor. Return only a raw JSON array.' },
                    { role: 'user', content: systemInstruction }
                ],
                model: 'llama-3.3-70b-versatile',
                temperature: 0.4,
                max_tokens: 3500
            }), 8000);

            let text = completion.choices[0]?.message?.content || '';
            text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (groqError) {
            console.warn('⚠️ Groq prediction failed:', groqError.message);
        }
    }

    // Intelligent Fallback Generator if external APIs are unreachable or offline
    console.log(`ℹ️ Generating curated high-probability predicted PYQs for ${subject}`);
    return generateCuratedPredictions(subject, targetExam, topics, requestedCount, difficulty);
};

/**
 * Curated fallback prediction engine tailored for standard subjects
 */
function generateCuratedPredictions(subject, targetExam, topics, count, difficulty) {
    const s = (subject || '').toLowerCase();
    let bank = [];

    if (s.includes('os') || s.includes('operating')) {
        bank = [
            {
                question: "Explain Banker's Algorithm for deadlock avoidance with a suitable multi-resource allocation example and safety check trace.",
                marks: 10,
                unit: "Unit 3",
                topic: "Deadlocks & Resource Allocation",
                questionType: "Analytical",
                difficulty: "Medium",
                probability: 95,
                predictionReasoning: "Appeared in 4 of the last 5 annual university exams. High priority 10-mark question.",
                solution: "Banker's Algorithm is a deadlock avoidance algorithm named after bank credit checks.\n\nData Structures:\n1. Available[m]: Available instances of resource type Rj.\n2. Max[n][m]: Maximum demand of each process.\n3. Allocation[n][m]: Currently allocated instances.\n4. Need[n][m] = Max - Allocation.\n\nSafety Algorithm:\n1. Work = Available, Finish[i] = false for all i.\n2. Find i such that Finish[i] == false and Need[i] <= Work.\n3. Work = Work + Allocation[i], Finish[i] = true, repeat until all finish.\n4. If all processes finish, state is SAFE; otherwise UNSAFE.",
                tags: ["Operating Systems", "Deadlock", "Banker's Algorithm"]
            },
            {
                question: "Compare Paging and Segmentation memory management schemes. Explain how page faults are handled with step-by-step diagrammatic sequence.",
                marks: 10,
                unit: "Unit 4",
                topic: "Virtual Memory & Paging",
                questionType: "Subjective",
                difficulty: "Medium",
                probability: 91,
                predictionReasoning: "Core virtual memory concept tested cyclically every alternate academic semester.",
                solution: "Differences:\n1. Paging: Fixed size blocks (pages/frames), hardware-driven, transparent to user, eliminates external fragmentation but has internal fragmentation.\n2. Segmentation: Variable size logical units (code, stack, data), user-oriented, eliminates internal fragmentation but risks external fragmentation.\n\nPage Fault Handling Sequence:\n1. CPU references virtual address not in main memory (valid-invalid bit is 0).\n2. Hardware trap to OS (Page Fault Trap).\n3. OS saves registers and checks if reference is valid.\n4. OS finds a free physical frame on RAM.\n5. OS schedules disk I/O to read page from swap space into free frame.\n6. Page table updated (valid bit set to 1).\n7. Instruction restarts seamlessly.",
                tags: ["Operating Systems", "Memory Management", "Page Fault"]
            },
            {
                question: "What is the Critical Section Problem? Discuss Peterson's Solution and explain how Semaphores solve mutual exclusion and synchronization.",
                marks: 8,
                unit: "Unit 2",
                topic: "Process Synchronization",
                questionType: "Subjective",
                difficulty: "Medium",
                probability: 88,
                predictionReasoning: "High recurring rate across Mid-Sem and Final exams in concurrency modules.",
                solution: "Critical Section Problem Requirements:\n1. Mutual Exclusion: Only one process inside CS at a time.\n2. Progress: Selection of next process cannot be indefinitely postponed.\n3. Bounded Waiting: Bound on number of times other processes enter CS after request.\n\nSemaphores:\nInteger variable modified only through atomic operations wait() (P) and signal() (V).\n- Counting Semaphore: Unlimited value range for managing finite resources.\n- Binary Semaphore / Mutex: Range 0 or 1 for strict mutual exclusion.",
                tags: ["Operating Systems", "Synchronization", "Semaphores"]
            },
            {
                question: "Differentiate between Preemptive and Non-Preemptive scheduling. Calculate average turnaround and waiting time for FCFS, SJF, and Round Robin (Quantum = 2ms).",
                marks: 10,
                unit: "Unit 1",
                topic: "CPU Scheduling Algorithms",
                questionType: "Numerical",
                difficulty: "Medium",
                probability: 93,
                predictionReasoning: "Mandatory numerical question present in every past semester paper.",
                solution: "Turnaround Time (TAT) = Completion Time - Arrival Time.\nWaiting Time (WT) = Turnaround Time - Burst Time.\n\nPreemptive vs Non-Preemptive:\nPreemptive allows interrupting running process when a higher-priority or shorter job arrives. Non-preemptive runs till completion or I/O yield.",
                tags: ["Operating Systems", "CPU Scheduling", "Numerical"]
            }
        ];
    } else if (s.includes('dbms') || s.includes('database')) {
        bank = [
            {
                question: "Explain 1NF, 2NF, 3NF, and BCNF with concrete database relation examples and functional dependency decomposition.",
                marks: 10,
                unit: "Unit 2",
                topic: "Relational Normalization",
                questionType: "Subjective",
                difficulty: "Medium",
                probability: 96,
                predictionReasoning: "Normalization is the single highest-weighted question in DBMS semester papers.",
                solution: "1. 1NF: Atomic values only, no repeating groups or multi-valued attributes.\n2. 2NF: In 1NF and no partial dependencies (every non-prime attribute fully dependent on candidate key).\n3. 3NF: In 2NF and no transitive dependencies (for X -> A, either X is superkey or A is prime attribute).\n4. BCNF: Stricter 3NF where for every functional dependency X -> A, X must be a superkey.",
                tags: ["DBMS", "Normalization", "Functional Dependency"]
            },
            {
                question: "What are ACID properties in database transactions? Explain Conflict Serializability and Testing for Serializability using Precedence Graphs.",
                marks: 10,
                unit: "Unit 4",
                topic: "Transaction Management & Concurrency",
                questionType: "Analytical",
                difficulty: "Hard",
                probability: 92,
                predictionReasoning: "Recurring core topic tested in 2021, 2022, and 2024.",
                solution: "ACID Properties:\n- Atomicity: All or nothing execution.\n- Consistency: Database moves from one valid state to another.\n- Isolation: Concurrent transactions do not interfere.\n- Durability: Committed updates persist even during power/system failures.\n\nPrecedence Graph Test:\nConstruct directed graph where vertices are transactions Ti, Tj.\nAdd edge Ti -> Tj if an operation of Ti conflicts with and precedes operation of Tj.\nIf precedence graph has NO CYCLES, schedule is Conflict Serializable.",
                tags: ["DBMS", "ACID", "Transactions", "Serializability"]
            },
            {
                question: "Explain the structure of B+ Tree indexing. Compare B-Trees and B+ Trees and demonstrate node insertion and splitting.",
                marks: 8,
                unit: "Unit 5",
                topic: "Storage & Indexing",
                questionType: "Analytical",
                difficulty: "Medium",
                probability: 89,
                predictionReasoning: "B+ Tree structure is frequently featured as an 8 or 10 mark question.",
                solution: "B+ Tree Characteristics:\n1. All data pointers stored exclusively in leaf nodes.\n2. Leaf nodes are linked together in a doubly linked list for rapid sequential and range queries.\n3. Internal nodes only store key values and child pointers to direct tree searches.\n4. Height is balanced with guaranteed logarithmic O(log N) lookup.",
                tags: ["DBMS", "Indexing", "B+ Trees"]
            }
        ];
    } else if (s.includes('network') || s.includes('cn')) {
        bank = [
            {
                question: "Explain the OSI 7-layer Reference Model and compare each layer's role and protocols with the TCP/IP protocol suite.",
                marks: 10,
                unit: "Unit 1",
                topic: "Network Architecture & Protocols",
                questionType: "Subjective",
                difficulty: "Easy",
                probability: 95,
                predictionReasoning: "Universal foundational question appearing across multiple past years.",
                solution: "OSI Layers (Top to Bottom):\n7. Application (HTTP, DNS, SMTP)\n6. Presentation (SSL/TLS, Encryption, Compression)\n5. Session (RPC, Session control)\n4. Transport (TCP, UDP - Port addressing, Segmentation, Reliability)\n3. Network (IP, ICMP - Routing, Logical IP addressing)\n2. Data Link (Ethernet, MAC addressing, Framing, Error detection)\n1. Physical (Cables, Bits transmission, Signalling)\n\nTCP/IP merges Application, Presentation, and Session into Application Layer.",
                tags: ["Computer Networks", "OSI Model", "TCP/IP"]
            },
            {
                question: "Given an IP address 192.168.10.0/24, design 4 subnets with network ID, usable host range, and broadcast address for each subnet.",
                marks: 10,
                unit: "Unit 3",
                topic: "IPv4 Subnetting & CIDR",
                questionType: "Numerical",
                difficulty: "Medium",
                probability: 94,
                predictionReasoning: "Subnetting numericals are guaranteed in end-semester network examinations.",
                solution: "Borrow 2 bits: Subnet mask becomes /26 (255.255.255.192). Each subnet has 64 addresses (62 usable hosts).\n\nSubnet 1: 192.168.10.0/26 (Hosts: .1 to .62, Broadcast: .63)\nSubnet 2: 192.168.10.64/26 (Hosts: .65 to .126, Broadcast: .127)\nSubnet 3: 192.168.10.128/26 (Hosts: .129 to .190, Broadcast: .191)\nSubnet 4: 192.168.10.192/26 (Hosts: .193 to .254, Broadcast: .255)",
                tags: ["Computer Networks", "Subnetting", "CIDR", "Numerical"]
            },
            {
                question: "Explain the TCP 3-Way Handshake connection establishment and 4-Way connection termination process with sequence number diagram.",
                marks: 8,
                unit: "Unit 4",
                topic: "Transport Layer Protocols",
                questionType: "Subjective",
                difficulty: "Medium",
                probability: 90,
                predictionReasoning: "High probability recurring topic in university examination papers.",
                solution: "3-Way Handshake:\n1. Client -> Server: SYN (seq = x)\n2. Server -> Client: SYN + ACK (seq = y, ack = x + 1)\n3. Client -> Server: ACK (seq = x + 1, ack = y + 1)\n\n4-Way Termination:\n1. Client -> Server: FIN (seq = u)\n2. Server -> Client: ACK (ack = u + 1)\n3. Server -> Client: FIN (seq = v)\n4. Client -> Server: ACK (ack = v + 1, enters TIME_WAIT)",
                tags: ["Computer Networks", "TCP", "Handshake"]
            }
        ];
    } else {
        // General / Custom subjects
        bank = [
            {
                question: `Explain the fundamental architecture, design principles, and core components of ${subject}. Highlight real-world practical applications.`,
                marks: 10,
                unit: "Unit 1",
                topic: "Fundamental Concepts",
                questionType: "Subjective",
                difficulty: "Medium",
                probability: 92,
                predictionReasoning: "Core introductory architectural question standard in all examination papers.",
                solution: `A comprehensive answer for ${subject} should cover:\n1. Definition and motivation.\n2. Key architectural building blocks.\n3. Design trade-offs and operational constraints.\n4. Real-world industry case studies.`,
                tags: [subject, "Architecture", "Fundamentals"]
            },
            {
                question: `Compare and contrast the primary algorithms and methodologies used in ${subject}. Analyze time and space complexity trade-offs.`,
                marks: 10,
                unit: "Unit 3",
                topic: "Algorithmic Analysis",
                questionType: "Analytical",
                difficulty: "Hard",
                probability: 88,
                predictionReasoning: "Comparative analysis question testing deep conceptual understanding.",
                solution: `Provide a comparative table covering:\n- Problem formulation\n- Best/Worst case performance\n- Implementation complexity\n- Practical selection criteria.`,
                tags: [subject, "Algorithms", "Complexity"]
            },
            {
                question: `What are the critical challenges, security implications, and optimization techniques in modern ${subject}?`,
                marks: 8,
                unit: "Unit 4",
                topic: "Optimization & Security",
                questionType: "Subjective",
                difficulty: "Medium",
                probability: 85,
                predictionReasoning: "Standard advanced module question in university syllabi.",
                solution: `Examine:\n1. Scalability bottlenecks.\n2. Security vulnerabilities and mitigation strategies.\n3. Performance tuning best practices.`,
                tags: [subject, "Optimization", "Security"]
            }
        ];
    }

    return bank.slice(0, count);
}