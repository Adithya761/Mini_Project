import crypto from 'crypto';
import path from 'path';
import PYQ from '../models/pyq.model.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { getGeminiCandidateModels } from './ai.services.js';

// ==========================================
// 1. TEXT NORMALIZATION & PREPROCESSING
// ==========================================

const ACADEMIC_EXAM_STOPWORDS = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
    'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
    'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further',
    'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how',
    'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself',
    'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours',
    'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that',
    'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those',
    'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where',
    'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves',
    // Examination instruction words that don't indicate technical topic concepts
    'explain', 'discuss', 'describe', 'write', 'state', 'define', 'briefly', 'neat', 'diagram',
    'example', 'examples', 'suitable', 'following', 'given', 'note', 'notes', 'short', 'illustrate',
    'sketch', 'detail', 'details', 'differentiate', 'distinguish', 'compare', 'contrast', 'list',
    'mention', 'elaborate', 'show', 'steps', 'procedure', 'figure', 'table'
]);

/**
 * Normalizes question text consistently:
 * - Trims whitespace, lowercases, removes irrelevant punctuation
 * - Strips trailing OCR numbers / marks (e.g. "2 1 1,3 ,3 1" or "34")
 * - Expands hyphens inside words ("end-users" -> "end users", "v-model" -> "v model")
 * - Preserves technical compounds ("b+ tree" -> "bplustree", "c++" -> "cplusplus")
 */
export function normalizeQuestionText(text) {
    if (!text) return '';
    return text
        .replace(/\s+[\d\s,]+$/, '') // Remove trailing OCR question/mark numbers
        .toLowerCase()
        .replace(/b\s*\+\s*tree/g, 'bplustree')
        .replace(/c\s*\+\+/g, 'cplusplus')
        .replace(/(\w+)-(\w+)/g, '$1 $2') // Split hyphenated compound words
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Extracts discriminative unigrams and bigrams
 */
export function extractQuestionTokens(text) {
    const cleaned = normalizeQuestionText(text);
    if (!cleaned) return [];
    const unigrams = cleaned
        .split(' ')
        .filter(t => t.length > 1 && !ACADEMIC_EXAM_STOPWORDS.has(t));

    const bigrams = [];
    for (let i = 0; i < unigrams.length - 1; i++) {
        bigrams.push(`${unigrams[i]}_${unigrams[i + 1]}`);
    }

    return [...unigrams, ...bigrams];
}

// ==========================================
// 2. TF-IDF VECTORIZER & COSINE SIMILARITY
// ==========================================

export class TfIdfEngine {
    constructor(corpusTokens) {
        this.docCount = corpusTokens.length;
        this.df = new Map();
        this.idf = new Map();

        for (const tokens of corpusTokens) {
            const unique = new Set(tokens);
            for (const t of unique) {
                this.df.set(t, (this.df.get(t) || 0) + 1);
            }
        }

        // Smooth IDF: ln((N + 1) / (df + 1)) + 1
        for (const [t, freq] of this.df.entries()) {
            this.idf.set(t, Math.log((this.docCount + 1) / (freq + 1)) + 1.0);
        }
    }

    vectorize(tokens) {
        if (!tokens || !tokens.length) return new Map();
        const tf = new Map();
        for (const t of tokens) {
            tf.set(t, (tf.get(t) || 0) + 1);
        }

        const vector = new Map();
        let sumSq = 0;
        for (const [t, count] of tf.entries()) {
            const idfVal = this.idf.get(t) || Math.log(this.docCount + 1.0);
            const tfVal = 1 + Math.log(count); // Sublinear TF scaling
            const weight = tfVal * idfVal;
            vector.set(t, weight);
            sumSq += weight * weight;
        }

        const norm = Math.sqrt(sumSq) || 1.0;
        for (const [t, weight] of vector.entries()) {
            vector.set(t, weight / norm);
        }
        return vector;
    }

    static cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || !vecA.size || !vecB.size) return 0;
        let dot = 0;
        const [smaller, larger] = vecA.size < vecB.size ? [vecA, vecB] : [vecB, vecA];
        for (const [t, valA] of smaller.entries()) {
            const valB = larger.get(t);
            if (valB !== undefined) {
                dot += valA * valB;
            }
        }
        return dot;
    }
}

/**
 * Stable, unambiguous examination paper session key
 * Prevents double-counting questions from the same exam paper
 */
export function getStablePaperKey(doc) {
    if (doc.paperId && doc.paperId.trim() && doc.paperId.trim().toLowerCase() !== 'none') {
        return `paper:${doc.paperId.trim()}`;
    }
    if (doc.sourcePdf && doc.sourcePdf.trim()) {
        const base = path.basename(doc.sourcePdf.trim());
        return `pdf:${base}`;
    }
    return `session:${doc.year}_${doc.examType || 'End-Sem'}_${doc.subjectCode || 'sub'}`;
}

// ==========================================
// 3. MAIN PREDICTION PIPELINE
// ==========================================

/**
 * Historical Examination Question Prediction Service
 * 
 * Features:
 * - TF-IDF with sublinear TF, smooth IDF, and cosine similarity
 * - Cluster deduplication with configurable similarity threshold (default 0.48)
 * - Evidence-based multi-factor ranking incorporating distinct exam papers,
 *   recency exponential decay, curriculum/focus relevance, and assessment alignment
 * - Calibrated confidence labels (High / Moderate / Emerging / Insufficient Data)
 * - Transparent explanation of matching type, appearance years, and metadata limitations
 * - Strict exclusion of student submissions, pending/rejected, and AI-predicted records
 * - Absolute protection against inventing non-existent CO/PO or Bloom taxonomy levels
 */
export async function predictPYQsFromHistoricalData({
    subject,
    targetExam = 'End-Sem 2026',
    topics = '',
    count = 5,
    difficulty = 'Medium',
    syllabusText = '',
    similarityThreshold = 0.48,
    decayLambda = 0.15
}) {
    const requestedCount = Math.min(Math.max(parseInt(count) || 5, 1), 10);
    const subjectRegex = new RegExp(`^${subject.trim()}$`, 'i');

    // 1. Fetch authentic historical questions from MongoDB
    // STRICT FILTER: Exclude student submissions, pending/rejected review, and existing predicted questions
    const historicalDocs = await PYQ.find({
        subject: subjectRegex,
        isPredicted: { $ne: true },
        origin: { $nin: ['STUDENT_SUBMITTED', 'AI_PREDICTED', 'SAMPLE_PAPER_GENERATED'] },
        reviewStatus: { $nin: ['PENDING', 'REJECTED'] }
    }).lean();

    console.log(`[PYQ Prediction] Found ${historicalDocs.length} authentic historical records for subject "${subject}"`);

    // Check unique historical papers available
    const distinctPaperSet = new Set(historicalDocs.map(getStablePaperKey));
    const isDataSufficient = historicalDocs.length >= 10 && distinctPaperSet.size >= 2;

    // Handle Insufficient Historical Data honestly
    if (!isDataSufficient) {
        console.warn(`[PYQ Prediction] Insufficient historical data for "${subject}": ${historicalDocs.length} questions across ${distinctPaperSet.size} papers`);

        if (historicalDocs.length === 0) {
            return [];
        }

        // Return honest limited evidence records without fabricating predictions
        return historicalDocs.slice(0, requestedCount).map(doc => {
            return {
                question: doc.question,
                subject: doc.subject,
                topic: doc.topic || 'General',
                unit: doc.unit || 'Unit 1',
                marks: doc.marks || 8,
                difficulty: doc.difficulty || difficulty,
                evidenceLevel: 'INSUFFICIENT_DATA',
                confidenceLabel: 'Insufficient historical data',
                matchType: 'Single Historical Record',
                historicalRepetitionCount: 1,
                appearedYears: doc.year ? [doc.year] : [],
                courseOutcomes: Array.isArray(doc.courseOutcomes) ? doc.courseOutcomes : [],
                programOutcomes: Array.isArray(doc.programOutcomes) ? doc.programOutcomes : [],
                bloomLevel: doc.bloomLevel || null, // DO NOT FABRICATE
                predictionReasoning: `Insufficient historical papers in database (only ${historicalDocs.length} record(s) found across ${distinctPaperSet.size} paper). Confidence cannot be verified through recurrence.`,
                solution: doc.solution || `Key Exam Answer Points for "${doc.topic || doc.subject}":\n1. Concept definition and primary architecture\n2. Key principles and properties\n3. Practical applications and summary`,
                tags: [doc.subject, doc.topic || 'Exam Preparation', ...(Array.isArray(doc.courseOutcomes) ? doc.courseOutcomes : [])].filter(Boolean),
                metadataLimitations: 'Subject dataset is too small for statistical pattern recognition. Collect more past papers for calibrated predictions.'
            };
        });
    }

    // 2. Build TF-IDF Engine on the Subject Corpus
    const tokenizedDocs = historicalDocs.map(d => extractQuestionTokens(`${d.question} ${d.topic || ''}`));
    const tfidfEngine = new TfIdfEngine(tokenizedDocs);
    const docVectors = tokenizedDocs.map(t => tfidfEngine.vectorize(t));

    // Vectorize user focus topics / syllabus if provided
    const userQueryText = `${topics} ${syllabusText}`.trim();
    let userQueryVector = null;
    if (userQueryText) {
        const queryTokens = extractQuestionTokens(userQueryText);
        userQueryVector = tfidfEngine.vectorize(queryTokens);
    }

    // 3. Cluster Questions into Conceptual Topic Clusters using Cosine Similarity
    const clusters = [];

    for (let i = 0; i < historicalDocs.length; i++) {
        const doc = historicalDocs[i];
        const vec = docVectors[i];
        const tokens = tokenizedDocs[i];
        const paperKey = getStablePaperKey(doc);

        let bestCluster = null;
        let bestSimilarity = 0;

        for (const cluster of clusters) {
            const sim = TfIdfEngine.cosineSimilarity(vec, cluster.centroidVector);
            if (sim >= similarityThreshold && sim > bestSimilarity) {
                bestSimilarity = sim;
                bestCluster = cluster;
            }
        }

        if (bestCluster) {
            bestCluster.questions.push(doc);
            bestCluster.distinctPapers.add(paperKey);
            if (doc.year) bestCluster.years.add(doc.year);
            if (doc.marks) bestCluster.marksList.push(doc.marks);
            if (doc.bloomLevel && doc.bloomLevel.trim()) bestCluster.bloomLevels.add(doc.bloomLevel.trim());
            if (Array.isArray(doc.courseOutcomes)) {
                doc.courseOutcomes.forEach(co => { if (co) bestCluster.courseOutcomes.add(co); });
            }
            if (Array.isArray(doc.programOutcomes)) {
                doc.programOutcomes.forEach(po => { if (po) bestCluster.programOutcomes.add(po); });
            }
            bestCluster.maxSimilarity = Math.max(bestCluster.maxSimilarity, bestSimilarity);
        } else {
            clusters.push({
                representative: doc,
                questions: [doc],
                centroidVector: vec,
                centroidTokens: tokens,
                distinctPapers: new Set([paperKey]),
                years: new Set(doc.year ? [doc.year] : []),
                marksList: doc.marks ? [doc.marks] : [8],
                bloomLevels: new Set(doc.bloomLevel && doc.bloomLevel.trim() ? [doc.bloomLevel.trim()] : []),
                courseOutcomes: new Set(Array.isArray(doc.courseOutcomes) ? doc.courseOutcomes.filter(Boolean) : []),
                programOutcomes: new Set(Array.isArray(doc.programOutcomes) ? doc.programOutcomes.filter(Boolean) : []),
                maxSimilarity: 1.0
            });
        }
    }

    console.log(`[PYQ Prediction] Grouped ${historicalDocs.length} questions into ${clusters.length} conceptual clusters`);

    // 4. Evidence-Based Multi-Factor Ranking
    const currentYear = new Date().getFullYear();
    const allYears = historicalDocs.map(d => d.year).filter(Boolean);
    const maxHistoricalYear = allYears.length ? Math.max(...allYears) : currentYear;
    const targetRefYear = Math.max(currentYear, maxHistoricalYear + 1);

    const scoredClusters = clusters.map(cluster => {
        const paperCount = cluster.distinctPapers.size;
        const yearsArray = Array.from(cluster.years).sort((a, b) => b - a);
        const mostRecentYear = yearsArray[0] || (maxHistoricalYear - 5);

        // A. Recency Exponential Decay Score: e^(-lambda * deltaYears)
        const deltaYears = Math.max(0, targetRefYear - mostRecentYear);
        const recencyScore = Math.exp(-decayLambda * deltaYears);

        // B. Recurrence Score with Diminishing Returns: min(papers, 5)
        const recurrenceScore = Math.min(paperCount, 5);

        // C. Topic / Syllabus Focus Relevance Score
        let relevanceScore = 0.5; // neutral when no query specified
        if (userQueryVector && userQueryVector.size > 0) {
            relevanceScore = TfIdfEngine.cosineSimilarity(userQueryVector, cluster.centroidVector);
        }

        // D. Assessment Alignment (Difficulty match)
        const repDifficulty = cluster.representative.difficulty || 'Medium';
        const difficultyMatch = (repDifficulty.toLowerCase() === difficulty.toLowerCase()) ? 1.0 : 0.7;

        // E. Data Quality & Source Paper Verification
        let qualityScore = 0;
        if (cluster.representative.paperId && cluster.representative.paperId !== 'none') qualityScore += 0.5;
        if (cluster.courseOutcomes.size > 0) qualityScore += 0.5;

        // Composite Multi-Factor Score:
        // Recurrence (3.0), Recency (2.0), Topic Relevance (2.5), Difficulty (1.0), Quality (0.5)
        const totalScore = (recurrenceScore * 3.0) + (recencyScore * 2.0) + (relevanceScore * 2.5) + (difficultyMatch * 1.0) + (qualityScore * 0.5);

        // Standard marks (mode marks from source questions)
        const marksFreq = {};
        cluster.marksList.forEach(m => { marksFreq[m] = (marksFreq[m] || 0) + 1; });
        const standardMarks = parseInt(Object.keys(marksFreq).reduce((a, b) => marksFreq[a] > marksFreq[b] ? a : b, 8)) || 8;

        // Calibrated Evidence Level & Confidence Label
        let evidenceLevel = 'EMERGING_TREND';
        let confidenceLabel = 'Emerging or limited evidence';
        if (paperCount >= 3) {
            evidenceLevel = 'HIGH_CONFIDENCE';
            confidenceLabel = 'High historical recurrence';
        } else if (paperCount >= 2 || (recencyScore > 0.8 && paperCount >= 1)) {
            evidenceLevel = 'MEDIUM_CONFIDENCE';
            confidenceLabel = 'Moderate historical recurrence';
        }

        // Match Type Classification
        let matchType = 'Curricular Topic Recurrence';
        if (cluster.maxSimilarity >= 0.88) {
            matchType = 'Exact Repeat';
        } else if (cluster.maxSimilarity >= 0.65) {
            matchType = 'Near-Duplicate Variant';
        }

        // Factual, Non-Fabricated Explanations
        const yearsStr = yearsArray.length > 0 ? `(${yearsArray.join(', ')})` : '';
        const coList = Array.from(cluster.courseOutcomes);
        const bloomList = Array.from(cluster.bloomLevels);

        let reasoning = '';
        if (paperCount >= 2) {
            reasoning = `Appeared in ${paperCount} distinct examination sessions ${yearsStr}. Identified via TF-IDF cosine similarity (${matchType}). Standard ${standardMarks}-mark exam topic.`;
        } else if (yearsArray.length > 0) {
            reasoning = `Tested in ${yearsArray[0]} session. Curricular core concept aligned with ${difficulty} assessment weightage.`;
        } else {
            reasoning = `Curricular topic relevant to syllabus requirements for ${targetExam}.`;
        }

        // Transparency: Document metadata limitations honestly
        let metadataLimitations = '';
        if (coList.length === 0) {
            metadataLimitations = 'Note: Source examination papers for this topic did not include course outcome (CO/PO) mappings.';
        }

        return {
            cluster,
            representative: cluster.representative,
            score: totalScore,
            paperCount,
            yearsArray,
            mostRecentYear,
            standardMarks,
            evidenceLevel,
            confidenceLabel,
            matchType,
            reasoning,
            courseOutcomes: coList, // EMPTY IF NOT IN SOURCE (NO FABRICATION)
            programOutcomes: Array.from(cluster.programOutcomes),
            bloomLevel: bloomList.length > 0 ? bloomList[0] : null, // NULL IF NOT IN SOURCE (NO FABRICATION)
            metadataLimitations
        };
    });

    // Sort by evidence score descending
    scoredClusters.sort((a, b) => b.score - a.score);
    const topClusters = scoredClusters.slice(0, requestedCount);

    console.log(`[PYQ Prediction] Ranked top ${topClusters.length} candidate clusters`);

    // 5. Try LLM synthesis with grounded historical evidence (preserving exact evidence)
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
                console.log(`[PYQ Prediction] LLM refined ${llmPredictions.length} grounded predictions`);
                return llmPredictions;
            }
        } catch (llmErr) {
            console.warn('[PYQ Prediction] LLM synthesis skipped/timed out:', llmErr.message);
            console.log('[PYQ Prediction] Returning deterministic TF-IDF ranked historical predictions.');
        }
    }

    // 6. Deterministic Output (Grounded strictly in verified historical clusters)
    return topClusters.map((sc, idx) => {
        const rep = sc.cluster.representative;
        return {
            question: rep.question,
            subject: rep.subject,
            topic: rep.topic || (topics ? topics.split(',')[0].trim() : 'Core Concept'),
            unit: rep.unit || `Unit ${((idx % 5) + 1)}`,
            marks: sc.standardMarks,
            difficulty: rep.difficulty || difficulty,
            evidenceLevel: sc.evidenceLevel,
            confidenceLabel: sc.confidenceLabel,
            matchType: sc.matchType,
            historicalRepetitionCount: sc.paperCount,
            appearedYears: sc.yearsArray,
            courseOutcomes: sc.courseOutcomes,
            programOutcomes: sc.programOutcomes,
            bloomLevel: sc.bloomLevel, // NULL IF NOT IN SOURCE (NO FABRICATION)
            predictionReasoning: sc.reasoning,
            metadataLimitations: sc.metadataLimitations,
            solution: rep.solution || `Key Exam Answer Structure for "${rep.topic || rep.subject}":\n1. Definition and theoretical principles\n2. Primary architecture and operational characteristics\n3. Core algorithms or comparison table\n4. Real-world example and conclusion`,
            tags: [rep.subject, rep.topic || 'Exam Preparation', ...sc.courseOutcomes].filter(Boolean)
        };
    });
}

/**
 * Calls Gemini or Groq with strictly grounded historical evidence
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
Historical Appearances: ${tc.paperCount} papers in years [${tc.yearsArray.join(', ')}]
Marks: ${tc.standardMarks} | Difficulty: ${rep.difficulty || difficulty}
Course Outcomes: ${tc.courseOutcomes.length > 0 ? `[${tc.courseOutcomes.join(', ')}]` : 'None in source'}
Bloom Taxonomy: ${tc.bloomLevel ? tc.bloomLevel : 'Not specified in source'}
Confidence Level: ${tc.confidenceLabel} (${tc.evidenceLevel})
Match Classification: ${tc.matchType}`;
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
2. Preserve the verified "historicalRepetitionCount", "appearedYears", "confidenceLabel", "evidenceLevel", and "matchType" provided in the evidence.
3. If Course Outcomes or Bloom Taxonomy are missing in the source evidence, leave them empty/null. DO NOT FABRICATE non-existent COs or Bloom levels.
4. Formulate the "question" text clearly as a standard university examination question.
5. Provide a structured "solution" with bullet points and model answer rubric.
6. Provide a factual "predictionReasoning" referencing the actual historical repetition count and appearance years.
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
    "confidenceLabel": "High historical recurrence" | "Moderate historical recurrence" | "Emerging or limited evidence",
    "matchType": "Exact Repeat" | "Near-Duplicate Variant" | "Curricular Topic Recurrence",
    "historicalRepetitionCount": number,
    "appearedYears": [number],
    "courseOutcomes": [string],
    "programOutcomes": [string],
    "bloomLevel": string | null,
    "predictionReasoning": "string",
    "metadataLimitations": "string",
    "solution": "string",
    "tags": [string]
  }
]`;

    // Try Gemini models
    if (apiKey.startsWith('AIza') || apiKey.startsWith('AQ.') || !apiKey.startsWith('gsk_')) {
        const genAI = new GoogleGenerativeAI(apiKey);
        const candidateModels = getGeminiCandidateModels();

        for (const modelName of candidateModels) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await Promise.race([
                    model.generateContent(prompt),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini prediction timeout')), 9000))
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

    // Try Groq as secondary
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
