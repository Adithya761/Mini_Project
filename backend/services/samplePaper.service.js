import crypto from 'crypto';
import PYQ from '../models/pyq.model.js';
import {
    normalizeQuestionText,
    extractQuestionTokens,
    TfIdfEngine
} from './pyqPrediction.service.js';

function hashText(text) {
    const norm = (text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return crypto.createHash('md5').update(norm).digest('hex').substring(0, 12);
}

/**
 * Normalizes unit identifiers across Roman numerals, Arabic digits, and textual labels.
 * e.g. "Unit - I", "Unit 1", "Module 1", "Unit – I" -> "unit1"
 */
export function normalizeUnit(unitStr) {
    if (!unitStr) return '';
    const clean = unitStr.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean.includes('1') || clean.includes(' i ') || clean.endsWith(' i') || clean === 'i' || clean.includes('unit i') || clean.includes('module i')) return 'unit1';
    if (clean.includes('2') || clean.includes(' ii ') || clean.endsWith(' ii') || clean === 'ii' || clean.includes('unit ii') || clean.includes('module ii')) return 'unit2';
    if (clean.includes('3') || clean.includes(' iii ') || clean.endsWith(' iii') || clean === 'iii' || clean.includes('unit iii') || clean.includes('module iii')) return 'unit3';
    if (clean.includes('4') || clean.includes(' iv ') || clean.endsWith(' iv') || clean === 'iv' || clean.includes('unit iv') || clean.includes('module iv')) return 'unit4';
    if (clean.includes('5') || clean.includes(' v ') || clean.endsWith(' v') || clean === 'v' || clean.includes('unit v') || clean.includes('module v')) return 'unit5';
    return clean;
}

/**
 * Standard university examination section templates
 */
export const DEFAULT_EXAM_TEMPLATES = {
    STANDARD_100: {
        id: "STANDARD_100",
        name: "Standard Semester End Examination (100 Marks)",
        duration: "3 Hours",
        durationMinutes: 180,
        totalMarks: 100,
        hasInternalChoice: true,
        sectionConfigs: [
            { name: "Unit I", instructions: "Answer Question 1 OR Question 2 (20 Marks)", marksPerQuestion: 20, questionsToAnswer: 1, totalQuestionsProvided: 2, allowedUnits: ["Unit 1", "Unit - I", "Unit – I", "Module 1"] },
            { name: "Unit II", instructions: "Answer Question 3 OR Question 4 (20 Marks)", marksPerQuestion: 20, questionsToAnswer: 1, totalQuestionsProvided: 2, allowedUnits: ["Unit 2", "Unit - II", "Unit – II", "Module 2"] },
            { name: "Unit III", instructions: "Answer Question 5 OR Question 6 (20 Marks)", marksPerQuestion: 20, questionsToAnswer: 1, totalQuestionsProvided: 2, allowedUnits: ["Unit 3", "Unit - III", "Unit – III", "Module 3"] },
            { name: "Unit IV", instructions: "Answer Question 7 OR Question 8 (20 Marks)", marksPerQuestion: 20, questionsToAnswer: 1, totalQuestionsProvided: 2, allowedUnits: ["Unit 4", "Unit - IV", "Unit – IV", "Module 4"] },
            { name: "Unit V", instructions: "Answer Question 9 OR Question 10 (20 Marks)", marksPerQuestion: 20, questionsToAnswer: 1, totalQuestionsProvided: 2, allowedUnits: ["Unit 5", "Unit - V", "Unit – V", "Module 5"] }
        ]
    },
    MID_SEM_50: {
        id: "MID_SEM_50",
        name: "Mid-Semester Assessment Test (50 Marks)",
        duration: "1.5 Hours",
        durationMinutes: 90,
        totalMarks: 50,
        hasInternalChoice: true,
        sectionConfigs: [
            { name: "Part A (Foundational)", instructions: "Answer all questions. Each carries 5 marks.", marksPerQuestion: 5, questionsToAnswer: 2, totalQuestionsProvided: 2, allowedUnits: ["Unit 1", "Unit - I", "Unit 2", "Unit - II"] },
            { name: "Part B (Analytical)", instructions: "Answer any two full questions from Question 3, 4, 5. Each carries 20 marks.", marksPerQuestion: 20, questionsToAnswer: 2, totalQuestionsProvided: 3, allowedUnits: ["Unit 1", "Unit - I", "Unit 2", "Unit - II", "Unit 3", "Unit - III"] }
        ]
    },
    FLEXIBLE_50: {
        id: "FLEXIBLE_50",
        name: "Model Question Paper (50 Marks, 5 x 10 Marks)",
        duration: "2 Hours",
        durationMinutes: 120,
        totalMarks: 50,
        hasInternalChoice: false,
        sectionConfigs: [
            { name: "Core Evaluation Section", instructions: "Answer five questions choosing from each topic unit. Each carries 10 marks.", marksPerQuestion: 10, questionsToAnswer: 5, totalQuestionsProvided: 5, allowedUnits: ["Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 5"] }
        ]
    }
};

/**
 * Computes cosine similarity between two question texts using TF-IDF vectors
 */
function computePairSimilarity(tfidfEngine, tokensA, tokensB) {
    if (!tokensA.length || !tokensB.length) return 0;
    const vecA = tfidfEngine.vectorize(tokensA);
    const vecB = tfidfEngine.vectorize(tokensB);
    return TfIdfEngine.cosineSimilarity(vecA, vecB);
}

/**
 * Deterministic PRNG using Linear Congruential Generator (LCG)
 * Guarantees 100% reproducible test execution for identical seeds.
 */
function createSeededRandom(seed = 42) {
    let s = Math.abs(seed) % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

/**
 * Generates an examination sample paper using a constraint-based selection solver.
 */
export async function generateSamplePaperService({
    subject,
    title,
    duration,
    totalMarks,
    sourcePolicy = 'HISTORICAL_ONLY',
    requireCOCoverage = false,
    coDistribution = {},
    difficultyDistribution = { Easy: 30, Medium: 50, Hard: 20 },
    sectionConfigs = null,
    userId = null,
    seed = 42
}) {
    if (!subject || !subject.trim()) {
        throw new Error('Subject name is required to generate a sample paper.');
    }

    const cleanSubject = subject.trim();
    const subRegex = new RegExp(`^${cleanSubject}$`, 'i');

    // 1. Fetch authentic historical questions (Strictly excluding student submissions, pending review, and predicted questions)
    const candidateDocs = await PYQ.find({
        subject: subRegex,
        isPredicted: { $ne: true },
        origin: { $nin: ['STUDENT_SUBMITTED', 'AI_PREDICTED', 'SAMPLE_PAPER_GENERATED'] },
        reviewStatus: { $nin: ['PENDING', 'REJECTED'] }
    }).lean();

    if (candidateDocs.length === 0) {
        throw new Error(`Question Bank Shortage: No authentic historical questions found for subject "${cleanSubject}".`);
    }

    // Minimum pool threshold for statistical examination generation
    const MIN_QUESTIONS_FOR_PAPER = 10;
    if (candidateDocs.length < MIN_QUESTIONS_FOR_PAPER) {
        throw new Error(
            `Question Bank Shortage: Subject "${cleanSubject}" has only ${candidateDocs.length} historical question(s) in the repository. A minimum of ${MIN_QUESTIONS_FOR_PAPER} questions is required to reliably generate an examination paper.`
        );
    }

    // 2. Assess OBE / Outcome Metadata in Source
    const docsWithCO = candidateDocs.filter(d => Array.isArray(d.courseOutcomes) && d.courseOutcomes.length > 0);
    const coCount = docsWithCO.length;

    let outcomeDataStatus = 'FULL_OBE_VERIFIED';
    let metadataLimitations = null;

    if (coCount === 0) {
        outcomeDataStatus = 'NO_OBE_METADATA_IN_SOURCE';
        metadataLimitations = `Subject "${cleanSubject}" historical archive predates Outcome-Based Education (OBE). Course Outcomes and Bloom Taxonomy are not specified in source examination papers.`;

        if (requireCOCoverage) {
            throw new Error(
                `Unsatisfiable Blueprint: Subject "${cleanSubject}" has 0 historical questions with Course Outcome (CO) mappings in the verified repository (source papers predate OBE). Please uncheck "Mandatory CO Quotas" to generate an authentic paper based on Units, Marks, and Difficulty.`
            );
        }
    } else if (coCount < candidateDocs.length * 0.7) {
        outcomeDataStatus = 'PARTIAL_OBE_AVAILABLE';
        metadataLimitations = `Partial OBE metadata: ${coCount} of ${candidateDocs.length} source questions contain verified CO mappings.`;
    }

    // 3. Resolve Blueprint and Section Configuration
    const requestedTotalMarks = parseInt(totalMarks) || 100;
    let resolvedSections = sectionConfigs;

    if (!resolvedSections || !Array.isArray(resolvedSections) || resolvedSections.length === 0) {
        if (requestedTotalMarks <= 50) {
            resolvedSections = DEFAULT_EXAM_TEMPLATES.MID_SEM_50.sectionConfigs;
        } else {
            resolvedSections = DEFAULT_EXAM_TEMPLATES.STANDARD_100.sectionConfigs;
        }
    }

    // Validate that sum of section marks matches the requested total
    const computedTotal = resolvedSections.reduce((sum, s) => {
        const qToAns = parseInt(s.questionsToAnswer) || 1;
        const marksPerQ = parseInt(s.marksPerQuestion) || 20;
        return sum + (qToAns * marksPerQ);
    }, 0);

    if (computedTotal !== requestedTotalMarks) {
        throw new Error(
            `Invalid Blueprint Configuration: The sum of required section marks (${computedTotal} Marks) does not equal the configured total marks (${requestedTotalMarks} Marks).`
        );
    }

    // 4. Precompute TF-IDF engine for intra-paper duplicate & near-duplicate prevention
    const candidateTokensList = candidateDocs.map(d => extractQuestionTokens(d.question));
    const tfidfEngine = new TfIdfEngine(candidateTokensList);

    const docIndexMap = new Map();
    candidateDocs.forEach((d, idx) => {
        docIndexMap.set(String(d._id), { doc: d, tokens: candidateTokensList[idx] });
    });

    // 5. Constraint-Based Question Selection Solver
    const rng = createSeededRandom(seed);
    const selectedQuestionIds = new Set();
    const selectedNormalizedTexts = new Set();
    const selectedTokensList = [];

    const assembledSections = [];
    const coAccumulator = {};
    const bloomAccumulator = {};
    const difficultyAccumulator = { Easy: 0, Medium: 0, Hard: 0 };
    const unitAccumulator = {};

    let globalQuestionNumber = 1;

    for (let sIdx = 0; sIdx < resolvedSections.length; sIdx++) {
        const secConfig = resolvedSections[sIdx];
        const marksTarget = parseInt(secConfig.marksPerQuestion) || 20;
        const neededCount = parseInt(secConfig.totalQuestionsProvided) || parseInt(secConfig.questionsToAnswer) || 2;
        const rawAllowedUnits = Array.isArray(secConfig.allowedUnits) && secConfig.allowedUnits.length > 0
            ? secConfig.allowedUnits
            : [`Unit ${sIdx + 1}`];

        const normalizedAllowedUnits = new Set(rawAllowedUnits.map(normalizeUnit));

        // Filter eligible candidates for this section
        const eligibleCandidates = candidateDocs.filter(d => {
            const docId = String(d._id);
            if (selectedQuestionIds.has(docId)) return false;

            const normQ = normalizeQuestionText(d.question);
            if (selectedNormalizedTexts.has(normQ)) return false;

            // Check Unit constraint
            const dNormUnit = normalizeUnit(d.unit);
            if (normalizedAllowedUnits.size > 0 && !normalizedAllowedUnits.has(dNormUnit)) {
                // If the subject has questions matching this specific unit, enforce it
                const subjectHasUnit = candidateDocs.some(q => normalizedAllowedUnits.has(normalizeUnit(q.unit)));
                if (subjectHasUnit) return false;
            }

            return true;
        });

        if (eligibleCandidates.length < neededCount) {
            throw new Error(
                `Question Bank Shortage: Section "${secConfig.name}" requires ${neededCount} question(s) for unit(s) [${rawAllowedUnits.join(', ')}], but only ${eligibleCandidates.length} eligible question(s) remain in the verified bank for "${cleanSubject}".`
            );
        }

        // Score candidates based on Difficulty Distribution, Topic Diversity, and Near-Duplicate Prevention
        const targetDifficulty = difficultyDistribution || { Easy: 30, Medium: 50, Hard: 20 };
        const totalMarksAssembledSoFar = Object.values(difficultyAccumulator).reduce((a, b) => a + b, 0) || 1;

        const scoredCandidates = eligibleCandidates.map(d => {
            const tokens = docIndexMap.get(String(d._id))?.tokens || [];
            let score = 50;

            // Penalty for near-duplicates with any previously selected question in the paper
            let maxSim = 0;
            for (const prevTokens of selectedTokensList) {
                const sim = computePairSimilarity(tfidfEngine, tokens, prevTokens);
                if (sim > maxSim) maxSim = sim;
            }

            // Severe penalty or exclusion if near-duplicate (>= 0.70)
            if (maxSim >= 0.70) {
                score -= 1000;
            } else if (maxSim >= 0.50) {
                score -= (maxSim * 50);
            }

            // Difficulty balance score
            const diff = d.difficulty || 'Medium';
            const currentPct = (difficultyAccumulator[diff] / totalMarksAssembledSoFar) * 100;
            const targetPct = targetDifficulty[diff] || 33;
            if (currentPct < targetPct) {
                score += 20;
            }

            // Outcome / CO balance score if OBE is active
            if (requireCOCoverage && Array.isArray(d.courseOutcomes) && d.courseOutcomes.length > 0) {
                score += 15;
            }

            // Deterministic seed weight: allows varied selection across seeds while prioritizing constraint satisfaction
            score += (rng() * 30);

            return { doc: d, tokens, score, maxSim };
        });

        // Filter out near-duplicates and sort descending
        scoredCandidates.sort((a, b) => b.score - a.score);
        const viable = scoredCandidates.filter(c => c.maxSim < 0.70);

        if (viable.length < neededCount) {
            throw new Error(
                `Constraint Conflict in Section "${secConfig.name}": Insufficient distinct questions available without duplicating concept patterns across sections.`
            );
        }

        const selectedForSection = [];

        for (let i = 0; i < neededCount; i++) {
            const chosen = viable[i].doc;
            const chosenTokens = viable[i].tokens;
            const docId = String(chosen._id);

            selectedQuestionIds.add(docId);
            selectedNormalizedTexts.add(normalizeQuestionText(chosen.question));
            selectedTokensList.push(chosenTokens);

            // Accumulate metrics
            const assignedMarks = marksTarget;
            const diff = chosen.difficulty || 'Medium';
            difficultyAccumulator[diff] = (difficultyAccumulator[diff] || 0) + assignedMarks;

            const uKey = chosen.unit || `Unit ${sIdx + 1}`;
            unitAccumulator[uKey] = (unitAccumulator[uKey] || 0) + assignedMarks;

            if (Array.isArray(chosen.courseOutcomes)) {
                chosen.courseOutcomes.forEach(co => {
                    coAccumulator[co] = (coAccumulator[co] || 0) + assignedMarks;
                });
            }

            if (chosen.bloomLevel && chosen.bloomLevel.trim()) {
                const bLevel = chosen.bloomLevel.trim();
                bloomAccumulator[bLevel] = (bloomAccumulator[bLevel] || 0) + assignedMarks;
            }

            selectedForSection.push({
                questionId: chosen._id,
                sourceQuestionId: chosen._id,
                sourceId: chosen._id,
                questionNumber: `${globalQuestionNumber}`,
                question: chosen.question,
                marks: assignedMarks,
                sourceMarks: chosen.marks || assignedMarks,
                unit: chosen.unit || `Unit ${sIdx + 1}`,
                topic: chosen.topic || 'General Concept',
                difficulty: diff,
                courseOutcomes: Array.isArray(chosen.courseOutcomes) ? chosen.courseOutcomes : [],
                programOutcomes: Array.isArray(chosen.programOutcomes) ? chosen.programOutcomes : [],
                bloomLevel: chosen.bloomLevel ? chosen.bloomLevel.trim() : null, // STRICT: NULL IF NOT IN SOURCE
                origin: chosen.origin || 'HISTORICAL_IMPORT',
                sourcePdf: chosen.sourcePdf || chosen.sourceRelativePath || '',
                paperId: chosen.paperId || ''
            });

            globalQuestionNumber++;
        }

        assembledSections.push({
            name: secConfig.name || `Section ${String.fromCharCode(65 + sIdx)}`,
            instructions: secConfig.instructions || `Answer ${secConfig.questionsToAnswer || 1} question(s) from this section.`,
            sectionMarks: (secConfig.questionsToAnswer || 1) * marksTarget,
            questionsToAnswer: secConfig.questionsToAnswer || 1,
            questions: selectedForSection
        });
    }

    // 6. Hard Validation: Check Section Marks and Question Counts
    validateSamplePaperStructure({
        sections: assembledSections,
        expectedTotalMarks: requestedTotalMarks
    });

    // 7. Check Mandatory CO Coverage if requested
    if (requireCOCoverage && outcomeDataStatus !== 'NO_OBE_METADATA_IN_SOURCE') {
        const requiredCOs = Object.keys(coDistribution);
        for (const co of requiredCOs) {
            const targetMarksForCO = parseInt(coDistribution[co]) || 0;
            const actualMarks = coAccumulator[co] || 0;
            if (targetMarksForCO > 0 && actualMarks < targetMarksForCO) {
                throw new Error(
                    `Unsatisfiable Outcome Blueprint: Deficit for Course Outcome ${co}. Required: ${targetMarksForCO} marks, Actual assembled: ${actualMarks} marks in the selected questions.`
                );
            }
        }
    }

    // 8. Build Comprehensive Coverage Summary
    const coCoverageSummary = {};
    Object.keys(coAccumulator).forEach(co => {
        coCoverageSummary[co] = {
            requiredMarks: (coDistribution && coDistribution[co]) ? coDistribution[co] : 0,
            actualMarks: coAccumulator[co],
            questionCount: assembledSections.flatMap(s => s.questions).filter(q => q.courseOutcomes.includes(co)).length
        };
    });

    const samplePaper = {
        title: title || `${cleanSubject} Semester End Examination Model Paper`,
        subject: cleanSubject,
        subjectCode: candidateDocs[0]?.subjectCode || '',
        institution: 'Siddaganga Institute of Technology, Tumakuru',
        degree: 'Bachelor of Engineering (B.E.)',
        branch: candidateDocs[0]?.branch || 'Computer Science and Engineering',
        duration: duration || '3 Hours',
        totalMarks: requestedTotalMarks,
        blueprint: {
            totalMarks: requestedTotalMarks,
            duration: duration || '3 Hours',
            sourcePolicy,
            requireCOCoverage,
            coDistribution,
            difficultyDistribution,
            sectionConfigs: resolvedSections,
            seed
        },
        sections: assembledSections,
        coverageSummary: {
            coCoverage: coCoverageSummary,
            bloomCoverage: bloomAccumulator,
            difficultyCoverage: difficultyAccumulator,
            unitCoverage: unitAccumulator,
            outcomeDataStatus,
            metadataLimitations
        },
        status: 'FINALIZED'
    };

    return samplePaper;
}

/**
 * Validates the structural integrity of a generated examination paper
 */
export function validateSamplePaperStructure({ sections, expectedTotalMarks }) {
    if (!sections || !Array.isArray(sections) || sections.length === 0) {
        throw new Error('Validation Error: Paper has no sections.');
    }

    let calculatedTotal = 0;
    const seenHashes = new Set();

    for (const sec of sections) {
        if (!sec.questions || sec.questions.length === 0) {
            throw new Error(`Validation Error: Section "${sec.name}" contains no questions.`);
        }

        const qToAnswer = sec.questionsToAnswer || 1;
        const qMarks = sec.questions[0]?.marks || 0;
        calculatedTotal += (qToAnswer * qMarks);

        // Check for duplicates within paper
        for (const q of sec.questions) {
            if (!q.marks || q.marks <= 0) {
                throw new Error(`Validation Error: Question ${q.questionNumber} in "${sec.name}" has invalid marks (${q.marks}).`);
            }

            const h = hashText(q.question);
            if (seenHashes.has(h)) {
                throw new Error(`Validation Error: Duplicate question detected in paper: "${q.question.substring(0, 40)}..."`);
            }
            seenHashes.add(h);
        }

        // Verify internal choice pairs have identical marks
        if (sec.questions.length > 1) {
            const firstMarks = sec.questions[0].marks;
            for (let i = 1; i < sec.questions.length; i++) {
                if (sec.questions[i].marks !== firstMarks) {
                    throw new Error(`Validation Error: Incompatible marks in section "${sec.name}". Question ${sec.questions[i].questionNumber} (${sec.questions[i].marks}M) does not match peer (${firstMarks}M).`);
                }
            }
        }
    }

    if (calculatedTotal !== expectedTotalMarks) {
        throw new Error(`Validation Error: Sum of section marks (${calculatedTotal} Marks) does not equal expected total (${expectedTotalMarks} Marks).`);
    }

    return true;
}

/**
 * Replace a single question with a valid historical alternative matching constraints.
 * Recalculates all outcome coverage and difficulty summaries.
 */
export async function replaceQuestionInSamplePaper({
    paperData,
    sectionIndex,
    questionIndex
}) {
    if (!paperData || !paperData.sections || !paperData.sections[sectionIndex]) {
        throw new Error('Invalid paper data or section index.');
    }

    const section = paperData.sections[sectionIndex];
    const targetQ = section.questions[questionIndex];
    if (!targetQ) {
        throw new Error('Target question not found in the specified section.');
    }

    const cleanSubject = paperData.subject.trim();
    const subRegex = new RegExp(`^${cleanSubject}$`, 'i');

    // Collect all question hashes currently in the paper
    const currentPaperHashes = new Set(
        paperData.sections.flatMap(s => s.questions).map(q => hashText(q.question))
    );

    // Fetch verified candidates from database
    const candidates = await PYQ.find({
        subject: subRegex,
        isPredicted: { $ne: true },
        origin: { $nin: ['STUDENT_SUBMITTED', 'AI_PREDICTED', 'SAMPLE_PAPER_GENERATED'] },
        reviewStatus: { $nin: ['PENDING', 'REJECTED'] }
    }).lean();

    // Prepare TF-IDF engine for near-duplicate check
    const candidateTokensList = candidates.map(c => extractQuestionTokens(c.question));
    const tfidfEngine = new TfIdfEngine(candidateTokensList);

    const otherQuestionsInPaperTokens = paperData.sections
        .flatMap((s, sI) => s.questions.filter((_, qI) => !(sI === sectionIndex && qI === questionIndex)))
        .map(q => extractQuestionTokens(q.question));

    const targetNormUnit = normalizeUnit(targetQ.unit);

    // Filter alternatives that are not in the paper, match unit and marks
    const alternatives = candidates.filter((c, idx) => {
        const h = hashText(c.question);
        if (currentPaperHashes.has(h)) return false;

        // Unit match
        const cNormUnit = normalizeUnit(c.unit);
        if (targetNormUnit && cNormUnit && targetNormUnit !== cNormUnit) {
            return false;
        }

        // Check near-duplicate with all other questions in the paper
        const cTokens = candidateTokensList[idx];
        for (const otherTokens of otherQuestionsInPaperTokens) {
            const sim = computePairSimilarity(tfidfEngine, cTokens, otherTokens);
            if (sim >= 0.70) return false;
        }

        return true;
    });

    if (alternatives.length === 0) {
        throw new Error(
            `No alternative questions available in the question bank for "${cleanSubject}" matching unit "${targetQ.unit || 'Current'}" without duplicating existing questions.`
        );
    }

    // Pick top alternative matching difficulty if possible
    let replacement = alternatives.find(a => (a.difficulty || 'Medium') === targetQ.difficulty) || alternatives[0];

    // Replace the question while preserving section and numbering
    section.questions[questionIndex] = {
        questionId: replacement._id,
        sourceQuestionId: replacement._id,
        sourceId: replacement._id,
        questionNumber: targetQ.questionNumber,
        question: replacement.question,
        marks: targetQ.marks, // Preserve calibrated section marks
        sourceMarks: replacement.marks || targetQ.marks,
        unit: replacement.unit || targetQ.unit,
        topic: replacement.topic || targetQ.topic,
        difficulty: replacement.difficulty || targetQ.difficulty || 'Medium',
        courseOutcomes: Array.isArray(replacement.courseOutcomes) ? replacement.courseOutcomes : [],
        programOutcomes: Array.isArray(replacement.programOutcomes) ? replacement.programOutcomes : [],
        bloomLevel: replacement.bloomLevel ? replacement.bloomLevel.trim() : null, // STRICT: NULL IF NOT IN SOURCE
        origin: replacement.origin || 'HISTORICAL_IMPORT',
        sourcePdf: replacement.sourcePdf || replacement.sourceRelativePath || '',
        paperId: replacement.paperId || ''
    };

    // Recalculate all coverage summaries
    const coAccumulator = {};
    const bloomAccumulator = {};
    const difficultyAccumulator = { Easy: 0, Medium: 0, Hard: 0 };
    const unitAccumulator = {};

    for (const sec of paperData.sections) {
        for (const q of sec.questions) {
            const m = q.marks || 10;
            const diff = q.difficulty || 'Medium';
            difficultyAccumulator[diff] = (difficultyAccumulator[diff] || 0) + m;

            const uKey = q.unit || 'General';
            unitAccumulator[uKey] = (unitAccumulator[uKey] || 0) + m;

            if (Array.isArray(q.courseOutcomes)) {
                q.courseOutcomes.forEach(co => {
                    coAccumulator[co] = (coAccumulator[co] || 0) + m;
                });
            }

            if (q.bloomLevel) {
                bloomAccumulator[q.bloomLevel] = (bloomAccumulator[q.bloomLevel] || 0) + m;
            }
        }
    }

    const coCoverageSummary = {};
    Object.keys(coAccumulator).forEach(co => {
        coCoverageSummary[co] = {
            requiredMarks: (paperData.blueprint?.coDistribution && paperData.blueprint.coDistribution[co]) ? paperData.blueprint.coDistribution[co] : 0,
            actualMarks: coAccumulator[co],
            questionCount: paperData.sections.flatMap(s => s.questions).filter(q => q.courseOutcomes.includes(co)).length
        };
    });

    paperData.coverageSummary = {
        coCoverage: coCoverageSummary,
        bloomCoverage: bloomAccumulator,
        difficultyCoverage: difficultyAccumulator,
        unitCoverage: unitAccumulator,
        outcomeDataStatus: paperData.coverageSummary?.outcomeDataStatus || 'FULL_OBE_VERIFIED',
        metadataLimitations: paperData.coverageSummary?.metadataLimitations || null
    };

    return paperData;
}

export const generateSamplePaper = generateSamplePaperService;

export default {
    generateSamplePaper: generateSamplePaperService,
    generateSamplePaperService,
    replaceQuestionInSamplePaper,
    validateSamplePaperStructure,
    DEFAULT_EXAM_TEMPLATES,
    normalizeUnit
};

