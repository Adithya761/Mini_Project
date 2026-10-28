import crypto from 'crypto';
import PYQ from '../models/pyq.model.js';

function hashText(text) {
    const norm = (text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return crypto.createHash('md5').update(norm).digest('hex').substring(0, 12);
}

/**
 * Standard university examination section templates
 */
export const DEFAULT_EXAM_TEMPLATES = {
    STANDARD_100: {
        title: "B.E. Semester End Examination Model Paper",
        duration: "3 Hours",
        totalMarks: 100,
        sectionConfigs: [
            { name: "Unit I", instructions: "Answer Question 1 OR Question 2 (20 Marks)", marksPerQuestion: 20, questionsToAnswer: 1, totalQuestionsProvided: 2, allowedUnits: ["Unit 1", "Unit I", "Module 1"] },
            { name: "Unit II", instructions: "Answer Question 3 OR Question 4 (20 Marks)", marksPerQuestion: 20, questionsToAnswer: 1, totalQuestionsProvided: 2, allowedUnits: ["Unit 2", "Unit II", "Module 2"] },
            { name: "Unit III", instructions: "Answer Question 5 OR Question 6 (20 Marks)", marksPerQuestion: 20, questionsToAnswer: 1, totalQuestionsProvided: 2, allowedUnits: ["Unit 3", "Unit III", "Module 3"] },
            { name: "Unit IV", instructions: "Answer Question 7 OR Question 8 (20 Marks)", marksPerQuestion: 20, questionsToAnswer: 1, totalQuestionsProvided: 2, allowedUnits: ["Unit 4", "Unit IV", "Module 4"] },
            { name: "Unit V", instructions: "Answer Question 9 OR Question 10 (20 Marks)", marksPerQuestion: 20, questionsToAnswer: 1, totalQuestionsProvided: 2, allowedUnits: ["Unit 5", "Unit V", "Module 5"] }
        ]
    },
    MID_SEM_50: {
        title: "B.E. Mid-Semester Assessment Test",
        duration: "1.5 Hours",
        totalMarks: 50,
        sectionConfigs: [
            { name: "Part A (Compulsory)", instructions: "Answer all questions. Each carries 5 marks.", marksPerQuestion: 5, questionsToAnswer: 2, totalQuestionsProvided: 2, allowedUnits: ["Unit 1", "Unit 2"] },
            { name: "Part B (Descriptive)", instructions: "Answer any two full questions from Question 3, 4, 5. Each carries 20 marks.", marksPerQuestion: 20, questionsToAnswer: 2, totalQuestionsProvided: 3, allowedUnits: ["Unit 1", "Unit 2", "Unit 3"] }
        ]
    },
    FLEXIBLE_50: {
        title: "Model Question Paper (5 x 10 Marks)",
        duration: "2 Hours",
        totalMarks: 50,
        sectionConfigs: [
            { name: "Core Evaluation Section", instructions: "Answer five questions choosing from each topic area.", marksPerQuestion: 10, questionsToAnswer: 5, totalQuestionsProvided: 7, allowedUnits: ["Unit 1", "Unit 2", "Unit 3", "Unit 4", "Unit 5"] }
        ]
    }
};

/**
 * Generate Sample Paper from Blueprint
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
    userId = null
}) {
    if (!subject || !subject.trim()) {
        throw new Error('Subject name is required to generate a sample paper.');
    }

    const subRegex = new RegExp(`^${subject.trim()}$`, 'i');

    // 1. Check subject question bank availability
    const totalInBank = await PYQ.countDocuments({
        subject: subRegex,
        isPredicted: false,
        origin: { $ne: 'STUDENT_SUBMITTED' }
    });

    if (totalInBank === 0) {
        throw new Error(`Question Bank Shortage: No historical questions found for subject "${subject}".`);
    }

    // 2. Check OBE availability
    const coCountInBank = await PYQ.countDocuments({
        subject: subRegex,
        isPredicted: false,
        origin: { $ne: 'STUDENT_SUBMITTED' },
        "courseOutcomes.0": { $exists: true }
    });

    let outcomeDataStatus = 'FULL_OBE_VERIFIED';
    if (coCountInBank === 0) {
        outcomeDataStatus = 'NO_OBE_METADATA_IN_SOURCE';
        if (requireCOCoverage) {
            throw new Error(
                `Unsatisfiable Blueprint: Subject "${subject}" has 0 historical questions with Course Outcome (CO) mappings in the verified repository. Authentic papers for this subject predate OBE. Please uncheck "Mandatory CO Quotas" or select a subject with verified OBE data (e.g., Database Management Systems or Software Engineering).`
            );
        }
    } else if (coCountInBank < totalInBank * 0.7) {
        outcomeDataStatus = 'PARTIAL_OBE_AVAILABLE';
    }

    // 3. Resolve section configuration
    const requestedTotalMarks = parseInt(totalMarks) || 100;
    let resolvedSections = sectionConfigs;

    if (!resolvedSections || !Array.isArray(resolvedSections) || resolvedSections.length === 0) {
        if (requestedTotalMarks <= 50) {
            resolvedSections = DEFAULT_EXAM_TEMPLATES.MID_SEM_50.sectionConfigs;
        } else {
            resolvedSections = DEFAULT_EXAM_TEMPLATES.STANDARD_100.sectionConfigs;
        }
    }

    // Fetch candidate historical questions from MongoDB
    const candidateDocs = await PYQ.find({
        subject: subRegex,
        isPredicted: false,
        origin: { $ne: 'STUDENT_SUBMITTED' }
    }).lean();

    // Group candidates by unit and mark ranges
    const usedQuestionHashes = new Set();
    const assembledSections = [];
    const coAccumulator = {};
    const bloomAccumulator = {};
    const difficultyAccumulator = {};

    let globalQuestionNumber = 1;

    for (let sIdx = 0; sIdx < resolvedSections.length; sIdx++) {
        const secConfig = resolvedSections[sIdx];
        const marksTarget = secConfig.marksPerQuestion || (requestedTotalMarks / (resolvedSections.length || 1));
        const neededCount = secConfig.totalQuestionsProvided || secConfig.questionsToAnswer || 2;
        const allowedUnits = Array.isArray(secConfig.allowedUnits) && secConfig.allowedUnits.length > 0
            ? secConfig.allowedUnits
            : [`Unit ${sIdx + 1}`, `Unit ${sIdx + 1}`.toUpperCase()];

        // Filter eligible questions for this section
        let eligible = candidateDocs.filter(d => {
            const h = hashText(d.question);
            if (usedQuestionHashes.has(h)) return false;

            // Unit check if configured
            if (allowedUnits.length > 0) {
                const uMatch = allowedUnits.some(u => {
                    const uClean = u.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const dClean = (d.unit || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    return dClean.includes(uClean) || uClean.includes(dClean);
                });
                if (!uMatch && candidateDocs.some(q => (q.unit || '').includes(allowedUnits[0]))) {
                    return false;
                }
            }

            return true;
        });

        // Controlled randomization for variation
        eligible.sort(() => Math.random() - 0.5);

        // Fallback: If strict unit filter yielded fewer than needed questions, relax unit constraint for that section
        if (eligible.length < neededCount) {
            eligible = candidateDocs.filter(d => !usedQuestionHashes.has(hashText(d.question)));
            eligible.sort(() => Math.random() - 0.5);
        }

        if (eligible.length < neededCount) {
            throw new Error(
                `Question Bank Shortage: Section "${secConfig.name}" requires ${neededCount} question(s) of ~${marksTarget} marks, but only ${eligible.length} eligible question(s) remain in the bank for "${subject}".`
            );
        }

        const selectedForSection = [];

        for (let i = 0; i < neededCount; i++) {
            const chosen = eligible[i];
            const qHash = hashText(chosen.question);
            usedQuestionHashes.add(qHash);

            // Calibrate marks to section requirement
            const assignedMarks = marksTarget;

            // Accumulate CO/PO and Bloom
            if (Array.isArray(chosen.courseOutcomes)) {
                chosen.courseOutcomes.forEach(co => {
                    coAccumulator[co] = (coAccumulator[co] || 0) + assignedMarks;
                });
            }
            if (chosen.bloomLevel) {
                bloomAccumulator[chosen.bloomLevel] = (bloomAccumulator[chosen.bloomLevel] || 0) + assignedMarks;
            }
            const diff = chosen.difficulty || 'Medium';
            difficultyAccumulator[diff] = (difficultyAccumulator[diff] || 0) + assignedMarks;

            selectedForSection.push({
                questionId: chosen._id,
                questionNumber: `Q${globalQuestionNumber}`,
                question: chosen.question,
                marks: assignedMarks,
                unit: chosen.unit || `Unit ${sIdx + 1}`,
                topic: chosen.topic || 'Curricular Concept',
                difficulty: diff,
                courseOutcomes: chosen.courseOutcomes || [],
                programOutcomes: chosen.programOutcomes || [],
                bloomLevel: chosen.bloomLevel || 'L2',
                origin: 'HISTORICAL_IMPORT',
                sourcePdf: chosen.sourcePdf || chosen.sourceRelativePath || '',
                paperId: chosen.paperId || ''
            });

            globalQuestionNumber++;
        }

        assembledSections.push({
            name: secConfig.name || `Section ${String.fromCharCode(65 + sIdx)}`,
            instructions: secConfig.instructions || `Answer ${secConfig.questionsToAnswer || 1} question(s) from this section.`,
            sectionMarks: (secConfig.questionsToAnswer || 1) * marksTarget,
            questions: selectedForSection
        });
    }

    // 4. Validate Hard CO Coverage Requirements if required
    if (requireCOCoverage && outcomeDataStatus !== 'NO_OBE_METADATA_IN_SOURCE') {
        const requiredCOs = Object.keys(coDistribution);
        for (const co of requiredCOs) {
            const requiredMarks = parseInt(coDistribution[co]) || 0;
            const actualMarks = coAccumulator[co] || 0;
            if (requiredMarks > 0 && actualMarks < requiredMarks) {
                throw new Error(
                    `Unsatisfiable Outcome Blueprint: Deficit for Course Outcome ${co}. Required: ${requiredMarks} marks, Actual assembled: ${actualMarks} marks. The historical bank does not have enough questions mapped to ${co} to satisfy this exact distribution.`
                );
            }
        }
    }

    // 5. Build Coverage Summary
    const coCoverageSummary = {};
    Object.keys(coAccumulator).forEach(co => {
        coCoverageSummary[co] = {
            requiredMarks: (coDistribution && coDistribution[co]) ? coDistribution[co] : 0,
            actualMarks: coAccumulator[co],
            questionCount: assembledSections.flatMap(s => s.questions).filter(q => q.courseOutcomes.includes(co)).length
        };
    });

    const samplePaper = {
        title: title || `${subject} Semester End Examination Model Paper`,
        subject: subject.trim(),
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
            sectionConfigs: resolvedSections
        },
        sections: assembledSections,
        coverageSummary: {
            coCoverage: coCoverageSummary,
            bloomCoverage: bloomAccumulator,
            difficultyCoverage: difficultyAccumulator,
            outcomeDataStatus
        },
        status: 'FINALIZED'
    };

    return samplePaper;
}

/**
 * Replace a single question with a valid historical alternative matching constraints
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

    const subRegex = new RegExp(`^${paperData.subject.trim()}$`, 'i');

    // Collect all hashes currently in the paper
    const existingHashes = new Set(
        paperData.sections.flatMap(s => s.questions).map(q => hashText(q.question))
    );

    // Find candidate replacements from DB
    const candidates = await PYQ.find({
        subject: subRegex,
        isPredicted: false,
        origin: { $ne: 'STUDENT_SUBMITTED' }
    }).lean();

    const alternatives = candidates.filter(c => {
        const h = hashText(c.question);
        if (existingHashes.has(h)) return false;

        // Match unit if possible
        if (targetQ.unit && c.unit && !c.unit.toLowerCase().includes(targetQ.unit.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
            return false;
        }

        return true;
    });

    alternatives.sort(() => Math.random() - 0.5);

    if (alternatives.length === 0) {
        // Relax unit filter
        const relaxedAlternatives = candidates.filter(c => !existingHashes.has(hashText(c.question)));
        relaxedAlternatives.sort(() => Math.random() - 0.5);

        if (relaxedAlternatives.length === 0) {
            throw new Error(`No alternative questions available in the question bank for "${paperData.subject}".`);
        }

        const newQ = relaxedAlternatives[0];
        section.questions[questionIndex] = {
            ...targetQ,
            questionId: newQ._id,
            question: newQ.question,
            topic: newQ.topic || targetQ.topic,
            courseOutcomes: newQ.courseOutcomes || [],
            programOutcomes: newQ.programOutcomes || [],
            bloomLevel: newQ.bloomLevel || targetQ.bloomLevel,
            sourcePdf: newQ.sourcePdf || '',
            paperId: newQ.paperId || ''
        };
    } else {
        const newQ = alternatives[0];
        section.questions[questionIndex] = {
            ...targetQ,
            questionId: newQ._id,
            question: newQ.question,
            topic: newQ.topic || targetQ.topic,
            courseOutcomes: newQ.courseOutcomes || [],
            programOutcomes: newQ.programOutcomes || [],
            bloomLevel: newQ.bloomLevel || targetQ.bloomLevel,
            sourcePdf: newQ.sourcePdf || '',
            paperId: newQ.paperId || ''
        };
    }

    return paperData;
}
