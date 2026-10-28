import crypto from 'crypto';
import PYQ from '../../../models/pyq.model.js';

function hashText(text) {
    const norm = (text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return crypto.createHash('md5').update(norm).digest('hex').substring(0, 12);
}

/**
 * Save predicted questions directly into the PYQ Bank with duplicate prevention
 * and explicit origin: 'AI_PREDICTED'
 */
export const savePredictedPYQ = async (req, res) => {
    try {
        const { questions, subject, targetExam } = req.body;
        const currentUserId = req.user?._id || req.user?.userId;

        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: 'No questions provided to save' });
        }

        const currentYear = new Date().getFullYear();
        const docsToInsert = [];
        let duplicateCount = 0;

        for (const q of questions) {
            const qText = (q.question || '').trim();
            if (!qText) continue;

            const qSubject = (q.subject || subject || 'Computer Science').trim();
            const qHash = hashText(qText);

            // Duplicate check against existing questions in DB
            const existing = await PYQ.findOne({
                subject: new RegExp(`^${qSubject}$`, 'i'),
                $or: [
                    { question: qText },
                    { paperQuestionKey: new RegExp(qHash, 'i') }
                ]
            }).lean();

            if (existing) {
                duplicateCount++;
                continue; // Skip duplicate to ensure idempotency
            }

            const yr = parseInt(q.year) || (targetExam ? parseInt((targetExam.match(/(20\d{2})/) || [])[1]) : currentYear) || currentYear;

            docsToInsert.push({
                subject: qSubject,
                subjectCode: (q.subjectCode || '').trim(),
                year: yr,
                examType: (q.examType || targetExam || 'End-Sem').trim(),
                question: qText,
                questionType: (q.questionType || 'Subjective').trim(),
                marks: parseInt(q.marks) || 8,
                unit: (q.unit || 'Unit 1').trim(),
                topic: (q.topic || 'Curricular Concept').trim(),
                solution: (q.solution || '').trim(),
                difficulty: (q.difficulty || 'Medium').trim(),
                bloomLevel: (q.bloomLevel || '').trim(),
                courseOutcomes: Array.isArray(q.courseOutcomes) ? q.courseOutcomes : [],
                programOutcomes: Array.isArray(q.programOutcomes) ? q.programOutcomes : [],
                origin: 'AI_PREDICTED',
                isPredicted: true,
                isVerified: false,
                reviewStatus: 'PENDING',
                predictionReasoning: (q.predictionReasoning || 'Identified via historical recurrence analysis').trim(),
                probability: parseInt(q.probability) || 85,
                frequency: parseInt(q.historicalRepetitionCount) || 1,
                historicalRepetitionCount: parseInt(q.historicalRepetitionCount) || 1,
                appearedYears: Array.isArray(q.appearedYears) ? q.appearedYears : [],
                evidenceLevel: q.evidenceLevel || 'MEDIUM_CONFIDENCE',
                addedBy: currentUserId,
                paperQuestionKey: `PRED_${qHash}`,
                tags: Array.isArray(q.tags) && q.tags.length > 0
                    ? q.tags
                    : [qSubject, 'Predicted', 'AI', ...(Array.isArray(q.courseOutcomes) ? q.courseOutcomes : [])].filter(Boolean)
            });
        }

        let inserted = [];
        if (docsToInsert.length > 0) {
            inserted = await PYQ.insertMany(docsToInsert);
        }

        const msg = duplicateCount > 0
            ? `Successfully introduced ${inserted.length} new predicted question(s) into the PYQ Bank (${duplicateCount} duplicate(s) skipped).`
            : `Successfully introduced ${inserted.length} predicted question(s) into the PYQ Bank!`;

        res.status(201).json({
            message: msg,
            count: inserted.length,
            duplicatesSkipped: duplicateCount,
            savedQuestions: inserted
        });
    } catch (error) {
        console.error('Error saving predicted PYQ:', error);
        res.status(500).json({ error: error.message || 'Failed to save predicted question(s)' });
    }
};
