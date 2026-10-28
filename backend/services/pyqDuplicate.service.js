import PYQ from '../models/pyq.model.js';
import {
    normalizeQuestionText,
    extractQuestionTokens,
    TfIdfEngine
} from './pyqPrediction.service.js';

/**
 * Supported subjects in the question bank.
 * Used for validation against authorized subject names.
 */
export const SUPPORTED_SUBJECTS = [
    'Database Management Systems',
    'Software Engineering',
    'Operating Systems',
    'Computer Networks',
    'Data Structures & Algorithms'
];

/**
 * Validates single question input against established application rules
 * and strips any privileged administrative fields.
 *
 * @param {Object} input - Raw request body
 * @returns {Object} { isValid, errors, sanitized }
 */
export function validateQuestionInput(input = {}) {
    const errors = [];

    // 1. Subject validation
    const rawSubject = (input.subject || '').trim();
    if (!rawSubject || rawSubject.length < 2) {
        errors.push('Subject name is required (minimum 2 characters).');
    }

    // 2. Question statement validation
    const rawQuestion = (input.question || '').trim();
    if (!rawQuestion) {
        errors.push('Question statement is required and cannot be empty.');
    } else if (rawQuestion.length < 15) {
        errors.push('Question statement must be at least 15 characters long.');
    } else if (rawQuestion.length > 3000) {
        errors.push('Question statement cannot exceed 3000 characters.');
    }

    // 3. Year validation
    const currentYear = new Date().getFullYear();
    const parsedYear = parseInt(input.year);
    if (isNaN(parsedYear) || parsedYear < 1990 || parsedYear > currentYear + 2) {
        errors.push(`Exam year must be a valid integer between 1990 and ${currentYear + 2}.`);
    }

    // 4. Marks validation (Established allowed range: 1 to 30)
    const parsedMarks = parseInt(input.marks);
    if (isNaN(parsedMarks) || parsedMarks < 1 || parsedMarks > 30) {
        errors.push('Marks must be a positive integer between 1 and 30.');
    }

    // 5. Difficulty validation (Optional: Easy, Medium, Hard)
    const validDifficulties = ['Easy', 'Medium', 'Hard'];
    let sanitizedDifficulty = 'Medium';
    if (input.difficulty) {
        const matched = validDifficulties.find(d => d.toLowerCase() === String(input.difficulty).toLowerCase().trim());
        if (matched) {
            sanitizedDifficulty = matched;
        } else {
            errors.push('Difficulty must be one of: Easy, Medium, Hard.');
        }
    }

    // 6. Bloom Taxonomy validation (Optional: L1 to L6)
    const validBloomLevels = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'];
    let sanitizedBloom = null;
    if (input.bloomLevel && String(input.bloomLevel).trim()) {
        const cleanBloom = String(input.bloomLevel).toUpperCase().trim();
        if (validBloomLevels.includes(cleanBloom)) {
            sanitizedBloom = cleanBloom;
        } else {
            errors.push('Bloom Level must be one of: L1, L2, L3, L4, L5, L6.');
        }
    }

    // 7. Course Outcomes validation (Optional: CO1 to CO6)
    let sanitizedCOs = [];
    if (input.courseOutcomes) {
        let rawCOList = [];
        if (Array.isArray(input.courseOutcomes)) {
            rawCOList = input.courseOutcomes;
        } else if (typeof input.courseOutcomes === 'string' && input.courseOutcomes.trim()) {
            rawCOList = input.courseOutcomes.split(',');
        }

        for (const item of rawCOList) {
            const clean = String(item).toUpperCase().trim();
            if (/^CO[1-6]$/i.test(clean)) {
                if (!sanitizedCOs.includes(clean)) sanitizedCOs.push(clean);
            } else if (clean) {
                errors.push(`Invalid Course Outcome "${clean}". Allowed values are CO1 to CO6.`);
            }
        }
    }

    // 8. Tags sanitization
    let sanitizedTags = [];
    if (input.tags) {
        if (Array.isArray(input.tags)) {
            sanitizedTags = input.tags.map(t => String(t).trim()).filter(Boolean);
        } else if (typeof input.tags === 'string' && input.tags.trim()) {
            sanitizedTags = input.tags.split(',').map(t => t.trim()).filter(Boolean);
        }
    }

    // 9. Prevent Mass-Assignment: Disallow client modification of privileged metadata
    const sanitized = {
        subject: rawSubject,
        subjectCode: (input.subjectCode || '').trim(),
        year: isNaN(parsedYear) ? currentYear : parsedYear,
        examType: (input.examType || 'End-Sem').trim(),
        question: rawQuestion,
        questionNumber: (input.questionNumber || '').trim(),
        questionType: (input.questionType || 'Subjective').trim(),
        marks: isNaN(parsedMarks) ? 5 : parsedMarks,
        unit: (input.unit || 'Unit 1').trim(),
        topic: (input.topic || 'General').trim(),
        solution: (input.solution || '').trim(),
        difficulty: sanitizedDifficulty,
        bloomLevel: sanitizedBloom,
        courseOutcomes: sanitizedCOs,
        tags: sanitizedTags,
        // Enforce strict student submission provenance:
        origin: 'STUDENT_SUBMITTED',
        reviewStatus: 'PENDING',
        isVerified: false,
        isPredicted: false,
        frequency: 1
    };

    return {
        isValid: errors.length === 0,
        errors,
        sanitized
    };
}

/**
 * Searches the database for exact and near-duplicate questions.
 * Uses exact text normalization and the prediction engine's TF-IDF cosine similarity.
 *
 * @param {Object} params
 * @param {string} params.subject - Subject to search within
 * @param {string} params.question - Question statement to test
 * @param {string} [params.excludeId] - Optional document ID to ignore (for edits)
 * @param {number} [params.thresholdLikelyNear=0.80] - Cosine threshold for near-duplicate warning
 * @param {number} [params.thresholdPossibleRelated=0.60] - Cosine threshold for related question notice
 * @returns {Promise<Object>} Duplicate analysis result
 */
export async function detectDuplicates({
    subject,
    question,
    excludeId = null,
    thresholdLikelyNear = 0.80,
    thresholdPossibleRelated = 0.60
}) {
    if (!question || typeof question !== 'string' || question.trim().length < 15) {
        return {
            status: 'INVALID',
            isDuplicate: false,
            requiresReview: false,
            message: 'Question statement is too short to perform duplicate analysis (minimum 15 characters).',
            matches: []
        };
    }

    if (!subject || typeof subject !== 'string' || subject.trim().length < 2) {
        return {
            status: 'INVALID',
            isDuplicate: false,
            requiresReview: false,
            message: 'A valid subject is required to perform duplicate analysis.',
            matches: []
        };
    }

    const trimmedInput = question.trim();
    const normalizedInput = normalizeQuestionText(trimmedInput);
    const subjectRegex = new RegExp(`^${subject.trim()}$`, 'i');

    // 1. Fetch existing questions for the given subject
    // Exclude private student metadata (do not expose addedBy, user IDs, etc.)
    const query = { subject: subjectRegex };
    if (excludeId) {
        query._id = { $ne: excludeId };
    }

    const existingDocs = await PYQ.find(query)
        .select('_id question subject year examType marks unit topic difficulty origin reviewStatus')
        .lean();

    if (!existingDocs || existingDocs.length === 0) {
        return {
            status: 'NO_DUPLICATE',
            isDuplicate: false,
            requiresReview: false,
            message: 'No existing questions found for this subject in the question bank. Question is completely unique!',
            matches: []
        };
    }

    // 2. CHECK A: Exact Duplicate Detection
    for (const doc of existingDocs) {
        const normDoc = normalizeQuestionText(doc.question);
        if (normDoc && normDoc === normalizedInput) {
            return {
                status: 'EXACT_DUPLICATE',
                isDuplicate: true,
                requiresReview: false,
                message: `Exact duplicate detected! An identical question already exists in the question bank for "${subject.trim()}".`,
                matches: [{
                    id: String(doc._id),
                    question: doc.question,
                    subject: doc.subject,
                    year: doc.year,
                    examType: doc.examType,
                    marks: doc.marks,
                    unit: doc.unit,
                    similarity: 1.0,
                    similarityPercentage: 100,
                    matchType: 'EXACT_DUPLICATE'
                }]
            };
        }
    }

    // 3. CHECK B: TF-IDF & Cosine Similarity Near-Duplicate Detection
    const inputTokens = extractQuestionTokens(trimmedInput);
    if (!inputTokens || inputTokens.length === 0) {
        return {
            status: 'NO_DUPLICATE',
            isDuplicate: false,
            requiresReview: false,
            message: 'Question appears unique.',
            matches: []
        };
    }

    // Build TF-IDF model with corpus of all subject questions + input question
    const docTokenList = existingDocs.map(d => extractQuestionTokens(d.question));
    const fullCorpus = [...docTokenList, inputTokens];
    const tfidfEngine = new TfIdfEngine(fullCorpus);

    const inputVec = tfidfEngine.vectorize(inputTokens);

    const scoredMatches = [];

    for (let i = 0; i < existingDocs.length; i++) {
        const doc = existingDocs[i];
        const docTokens = docTokenList[i];
        if (!docTokens || docTokens.length === 0) continue;

        const docVec = tfidfEngine.vectorize(docTokens);
        const similarity = TfIdfEngine.cosineSimilarity(inputVec, docVec);

        if (similarity >= thresholdPossibleRelated) {
            const isLikelyNear = similarity >= thresholdLikelyNear;
            scoredMatches.push({
                id: String(doc._id),
                question: doc.question,
                subject: doc.subject,
                year: doc.year,
                examType: doc.examType,
                marks: doc.marks,
                unit: doc.unit,
                similarity: parseFloat(similarity.toFixed(3)),
                similarityPercentage: Math.round(similarity * 100),
                matchType: isLikelyNear ? 'LIKELY_NEAR_DUPLICATE' : 'POSSIBLE_RELATED'
            });
        }
    }

    // Sort by similarity descending
    scoredMatches.sort((a, b) => b.similarity - a.similarity);
    const topMatches = scoredMatches.slice(0, 5);

    const hasLikelyNear = topMatches.some(m => m.matchType === 'LIKELY_NEAR_DUPLICATE');

    if (hasLikelyNear) {
        const highestMatch = topMatches[0];
        return {
            status: 'LIKELY_NEAR_DUPLICATE',
            isDuplicate: false,
            requiresReview: true,
            message: `Potential near-duplicate detected with ${highestMatch.similarityPercentage}% conceptual similarity to an existing exam question. Please review the matches before submitting.`,
            matches: topMatches
        };
    }

    if (topMatches.length > 0) {
        return {
            status: 'POSSIBLE_RELATED',
            isDuplicate: false,
            requiresReview: false,
            message: `Found ${topMatches.length} related question(s) in the same topic area, but your question appears distinct.`,
            matches: topMatches
        };
    }

    return {
        status: 'NO_DUPLICATE',
        isDuplicate: false,
        requiresReview: false,
        message: 'No duplicates found. The question appears unique in the question bank.',
        matches: []
    };
}
