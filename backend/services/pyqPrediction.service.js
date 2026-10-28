import crypto from 'crypto';
import PYQ from '../models/pyq.model.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

/**
 * Normalizes question text for robust deduplication and conceptual clustering
 */
function normalizeText(text) {
    return (text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Generates an MD5 signature of normalized text
 */
function hashText(text) {
    const norm = normalizeText(text).replace(/\s/g, '');
    return crypto.createHash('md5').update(norm).digest('hex').substring(0, 12);
}

/**
 * Extracts key semantic tokens for keyword relevance matching
 */
function extractTokens(text) {
    const stopWords = new Set([
        'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'in', 'of', 'for', 'to', 'with',
        'explain', 'discuss', 'describe', 'write', 'what', 'how', 'state', 'define', 'briefly',
        'with', 'neat', 'diagram', 'example', 'suitable', 'following', 'given', 'each', 'any'
    ]);
    return normalizeText(text)
        .split(' ')
        .filter(t => t.length > 2 && !stopWords.has(t));
}

/**
 * Computes Jaccard similarity between two token sets
 */
function tokenSimilarity(tokensA, tokensB) {
    if (!tokensA.length || !tokensB.length) return 0;
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    let intersection = 0;
    for (const t of setA) {
        if (setB.has(t)) intersection++;
    }
    const union = new Set([...tokensA, ...tokensB]).size;
    return union > 0 ? intersection / union : 0;
}

/**
 * Historical Question Prediction Service
 * 
 * Analyzes authentic university examination papers in MongoDB, calculates
 * exact repetition across distinct exam sessions, incorporates CO/PO/Bloom evidence,
 * and synthesizes grounded predictions with calibrated evidence levels.
 */
export async function predictPYQsFromHistoricalData({
    subject,
    targetExam = 'End-Sem 2026',
    topics = '',
    count = 5,
    difficulty = 'Medium',
    syllabusText = ''
}) {
    const requestedCount = Math.min(Math.max(parseInt(count) || 5, 1), 10);
    const subjectRegex = new RegExp(`^${subject.trim()}$`, 'i');

    // 1. Fetch authentic historical questions from MongoDB
    const historicalDocs = await PYQ.find({
        subject: subjectRegex,
        isPredicted: false,
        origin: { $nin: ['STUDENT_SUBMITTED', 'SAMPLE_PAPER_GENERATED'] },
        reviewStatus: { $nin: ['PENDING', 'REJECTED'] }
    }).lean();

    console.log(`[PYQ Prediction] Found ${historicalDocs.length} authentic records for subject "${subject}"`);

    const focusTokens = extractTokens(`${topics} ${syllabusText}`);

    // 2. Group questions into conceptual clusters to detect repetition across distinct papers
    const clusters = [];

    for (const doc of historicalDocs) {
        const docTokens = extractTokens(`${doc.question} ${doc.topic}`);
        const paperIdentifier = doc.paperId || doc.sourcePdf || `${doc.year}_${doc.examType}_${doc.subjectCode}`;

        // Find existing cluster with high similarity
        let matchedCluster = null;
        for (const cluster of clusters) {
            const sim = tokenSimilarity(docTokens, cluster.centroidTokens);
            if (sim >= 0.45) { // 45%+ token overlap indicates closely related or recurring question
                matchedCluster = cluster;
                break;
            }
        }

        if (matchedCluster) {
            matchedCluster.questions.push(doc);
            matchedCluster.distinctPapers.add(paperIdentifier);
            if (doc.year) matchedCluster.years.add(doc.year);
            if (doc.bloomLevel) matchedCluster.bloomLevels.add(doc.bloomLevel);
            if (Array.isArray(doc.courseOutcomes)) {
                doc.courseOutcomes.forEach(co => matchedCluster.courseOutcomes.add(co));
            }
            if (Array.isArray(doc.programOutcomes)) {
                doc.programOutcomes.forEach(po => matchedCluster.programOutcomes.add(po));
            }
            if (doc.marks) matchedCluster.marksList.push(doc.marks);
        } else {
            const newCluster = {
                representative: doc,
                questions: [doc],
                centroidTokens: docTokens,
                distinctPapers: new Set([paperIdentifier]),
                years: new Set(doc.year ? [doc.year] : []),
                bloomLevels: new Set(doc.bloomLevel ? [doc.bloomLevel] : []),
                courseOutcomes: new Set(Array.isArray(doc.courseOutcomes) ? doc.courseOutcomes : []),
                programOutcomes: new Set(Array.isArray(doc.programOutcomes) ? doc.programOutcomes : []),
                marksList: doc.marks ? [doc.marks] : [5]
            };
            clusters.push(newCluster);
        }
    }

    // 3. Score and rank clusters based on repetition, recency, difficulty, and topic relevance
    const currentYear = new Date().getFullYear();

    const scoredClusters = clusters.map(cluster => {
        const repetitionCount = cluster.distinctPapers.size;
        const yearsArray = Array.from(cluster.years).sort((a, b) => b - a);
        const mostRecentYear = yearsArray[0] || 2020;

        // Recency score (higher weight for papers within last 4 years)
        const recencyScore = Math.max(0, 1 - (currentYear - mostRecentYear) / 10);

        // Topic / syllabus relevance score
        let topicRelevance = 0.5;
        if (focusTokens.length > 0) {
            topicRelevance = tokenSimilarity(focusTokens, cluster.centroidTokens);
        }

        // Difficulty alignment score
        const repDifficulty = cluster.representative.difficulty || 'Medium';
        const difficultyMatch = (repDifficulty.toLowerCase() === difficulty.toLowerCase()) ? 1.0 : 0.6;

        // Composite scoring formula
        // Heavily weights repetition across distinct papers, boosted by recency and user topic focus
        const score = (repetitionCount * 2.5) + (recencyScore * 1.5) + (topicRelevance * 3.0) + (difficultyMatch * 1.0);

        // Mode marks calculation
        const marksCount = {};
        cluster.marksList.forEach(m => { marksCount[m] = (marksCount[m] || 0) + 1; });
        const standardMarks = parseInt(Object.keys(marksCount).reduce((a, b) => marksCount[a] > marksCount[b] ? a : b, 8)) || 8;

        // Evidence level determination
        let evidenceLevel = 'EMERGING_TREND';
        if (repetitionCount >= 3) {
            evidenceLevel = 'HIGH_CONFIDENCE';
        } else if (repetitionCount >= 2 || (topicRelevance > 0.4 && recencyScore > 0.7)) {
            evidenceLevel = 'MEDIUM_CONFIDENCE';
        }

        // Grounded reasoning description
        const yearsStr = yearsArray.length > 0 ? `(${yearsArray.join(', ')})` : '';
        const coList = Array.from(cluster.courseOutcomes);
        const coStr = coList.length > 0 ? ` Assessing ${coList.join('/')}.` : '';
        const bloomList = Array.from(cluster.bloomLevels);
        const bloomStr = bloomList.length > 0 ? ` Bloom: ${bloomList.join('/')}.` : '';

        let reasoning = '';
        if (repetitionCount >= 2) {
            reasoning = `Appeared in ${repetitionCount} distinct university examination sessions ${yearsStr}.${coStr}${bloomStr} Standard ${standardMarks}-mark exam question.`;
        } else if (yearsArray.length > 0) {
            reasoning = `Curricular core topic tested in ${yearsArray[0]}.${coStr}${bloomStr} Relevant to ${difficulty} assessment weightage.`;
        } else {
            reasoning = `Aligned with syllabus core concepts.${coStr}${bloomStr} Recommended for ${targetExam}.`;
        }

        return {
            cluster,
            score,
            repetitionCount,
            yearsArray,
            mostRecentYear,
            standardMarks,
            evidenceLevel,
            reasoning,
            courseOutcomes: coList,
            programOutcomes: Array.from(cluster.programOutcomes),
            bloomLevel: bloomList[0] || (standardMarks >= 10 ? 'L3' : 'L2')
        };
    });

    // Sort by score descending
    scoredClusters.sort((a, b) => b.score - a.score);
    const topClusters = scoredClusters.slice(0, requestedCount);

    console.log(`[PYQ Prediction] Ranked top ${topClusters.length} historical question clusters`);

    // 4. Try LLM synthesis with grounded historical evidence
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.QUIZ_API_KEY || process.env.GROQ_API_KEY;

    if (apiKey && topClusters.length > 0) {
        try {
            const llmPredictions = await generateLLMPredictionsWithGrounding({
                subject,
                targetExam,
                topics,
                difficulty,
                topClusters,
                apiKey
            });

            if (Array.isArray(llmPredictions) && llmPredictions.length > 0) {
                console.log(`[PYQ Prediction] LLM successfully refined ${llmPredictions.length} grounded predictions`);
                return llmPredictions;
            }
        } catch (llmErr) {
            console.warn('[PYQ Prediction] LLM generation failed or timed out:', llmErr.message);
            console.log('[PYQ Prediction] Falling back to deterministic historical pattern ranking engine.');
        }
    }

    // 5. Deterministic fallback directly using historical clusters (NO HARDCODED MOCKS)
    return topClusters.map((sc, idx) => {
        const rep = sc.cluster.representative;
        return {
            question: rep.question,
            subject: rep.subject,
            topic: rep.topic || (focusTokens[0] ? focusTokens[0] : 'Core Concept'),
            unit: rep.unit || `Unit ${((idx % 5) + 1)}`,
            marks: sc.standardMarks,
            difficulty: rep.difficulty || difficulty,
            evidenceLevel: sc.evidenceLevel,
            historicalRepetitionCount: sc.repetitionCount,
            appearedYears: sc.yearsArray,
            courseOutcomes: sc.courseOutcomes,
            programOutcomes: sc.programOutcomes,
            bloomLevel: sc.bloomLevel,
            predictionReasoning: sc.reasoning,
            solution: rep.solution || `Key Exam Answer Points for "${rep.topic || rep.subject}":\n1. Definition and theoretical overview\n2. Primary architecture and operational principles\n3. Core algorithms or comparison table\n4. Real-world example and conclusion`,
            tags: [rep.subject, rep.topic || 'Exam Preparation', ...sc.courseOutcomes].filter(Boolean)
        };
    });
}

/**
 * Calls Gemini or Groq with factual historical evidence injected into context
 */
async function generateLLMPredictionsWithGrounding({
    subject,
    targetExam,
    topics,
    difficulty,
    topClusters,
    apiKey
}) {
    const historicalEvidenceSummary = topClusters.map((tc, idx) => {
        const rep = tc.cluster.representative;
        return `[Candidate ${idx + 1}]
Question Pattern: "${rep.question}"
Topic: ${rep.topic || 'General'}
Historical Appearances: ${tc.repetitionCount} papers in years [${tc.yearsArray.join(', ')}]
Marks: ${tc.standardMarks} | Difficulty: ${rep.difficulty || difficulty}
Course Outcomes: [${tc.courseOutcomes.join(', ')}]
Bloom Taxonomy: ${tc.bloomLevel}`;
    }).join('\n\n');

    const prompt = `You are a university examination board committee specialist for "${subject}".
Based strictly on the following HISTORICAL EXAMINATION EVIDENCE extracted from verified university papers, synthesize ${topClusters.length} predicted questions for upcoming ${targetExam}.

HISTORICAL EVIDENCE:
${historicalEvidenceSummary}

USER CRITERIA:
- Target Exam: ${targetExam}
- Focus Topics: ${topics || 'Standard syllabus distribution'}
- Target Difficulty: ${difficulty}

RULES:
1. Ground each prediction in the provided historical candidate patterns. Do NOT fabricate fake years or fake examination appearances.
2. Preserve the verified "historicalRepetitionCount", "appearedYears", "courseOutcomes", and "bloomLevel" provided in the evidence.
3. Formulate the "question" text clearly as a standard university examination question.
4. Provide a structured "solution" with bullet points and model answer rubric.
5. Provide a factual "predictionReasoning" referencing the actual historical repetition count and appearance years.
6. Set "evidenceLevel" to "HIGH_CONFIDENCE", "MEDIUM_CONFIDENCE", or "EMERGING_TREND" matching the provided candidate data.
7. Return ONLY a valid JSON array of objects.

JSON SCHEMA:
[
  {
    "question": "string",
    "subject": "${subject}",
    "topic": "string",
    "unit": "string",
    "marks": number,
    "difficulty": "Easy" | "Medium" | "Hard",
    "evidenceLevel": "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "EMERGING_TREND",
    "historicalRepetitionCount": number,
    "appearedYears": [number],
    "courseOutcomes": [string],
    "programOutcomes": [string],
    "bloomLevel": "string",
    "predictionReasoning": "string",
    "solution": "string",
    "tags": [string]
  }
]`;

    // Try Gemini
    if (apiKey.startsWith('AIza') || apiKey.startsWith('AQ.') || !apiKey.startsWith('gsk_')) {
        const genAI = new GoogleGenerativeAI(apiKey);
        const candidateModels = [
            process.env.GEMINI_MODEL,
            'gemini-flash-lite-latest',
            'gemini-3.1-flash-lite',
            'gemini-3.5-flash',
            'gemini-3.8-flash'
        ].filter(Boolean);

        for (const modelName of [...new Set(candidateModels)]) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await Promise.race([
                    model.generateContent(prompt),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini prediction timeout')), 10000))
                ]);

                const response = await result.response;
                let text = response.text() || '';
                text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
                const jsonMatch = text.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
                }
            } catch (gemErr) {
                console.warn(`Gemini prediction attempt failed with ${modelName}:`, gemErr.message);
            }
        }
    }

    // Try Groq
    const groqKey = process.env.GROQ_API_KEY || (apiKey.startsWith('gsk_') ? apiKey : null);
    if (groqKey) {
        const groq = new Groq({ apiKey: groqKey });
        const completion = await Promise.race([
            groq.chat.completions.create({
                messages: [
                    { role: 'system', content: 'You are an academic exam predictor. Return ONLY a raw JSON array.' },
                    { role: 'user', content: prompt }
                ],
                model: 'llama-3.3-70b-versatile',
                temperature: 0.3,
                max_tokens: 3500
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Groq prediction timeout')), 8000))
        ]);

        let text = completion.choices[0]?.message?.content || '';
        text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    }

    return null;
}
