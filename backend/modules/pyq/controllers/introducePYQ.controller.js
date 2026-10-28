import crypto from 'crypto';
import PYQ from '../../../models/pyq.model.js';
import { validateQuestionInput, detectDuplicates } from '../../../services/pyqDuplicate.service.js';

function hashText(text) {
    const norm = (text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return crypto.createHash('md5').update(norm).digest('hex').substring(0, 12);
}

/**
 * Introduce a single Previous Year Question from the Student Portal.
 *
 * Enforces:
 * 1. Strict server-side validation against established rules.
 * 2. Exact duplicate prevention and TF-IDF cosine near-duplicate detection.
 * 3. Immutable student submission provenance:
 *    - origin: 'STUDENT_SUBMITTED'
 *    - reviewStatus: 'PENDING'
 *    - isVerified: false
 *    - isPredicted: false
 * 4. Exclusion of pending questions from historical recurrence until approved.
 */
export const introducePYQ = async (req, res) => {
    try {
        const {
            subject,
            subjectCode,
            year,
            examType,
            question,
            questionNumber,
            questionType,
            marks,
            unit,
            topic,
            courseOutcomes,
            bloomLevel,
            solution,
            difficulty,
            tags,
            confirmedDistinct = false
        } = req.body;

        const currentUserId = req.user?._id || req.user?.id || req.user?.userId;

        // 1. Validate fields and strip privileged mass-assignment
        const validation = validateQuestionInput({
            subject,
            subjectCode,
            year,
            examType,
            question,
            questionNumber,
            questionType,
            marks,
            unit,
            topic,
            courseOutcomes,
            bloomLevel,
            solution,
            difficulty,
            tags
        });

        if (!validation.isValid) {
            return res.status(400).json({
                error: validation.errors[0] || 'Invalid question parameters',
                validationErrors: validation.errors
            });
        }

        const sanitized = validation.sanitized;
        const qHash = hashText(sanitized.question);
        const paperQuestionKey = `STUDENT_${qHash}`;

        // 2. Server-side Duplicate Detection immediately before insertion
        const duplicateCheck = await detectDuplicates({
            subject: sanitized.subject,
            question: sanitized.question
        });

        // Exact Duplicate: Hard rejection
        if (duplicateCheck.status === 'EXACT_DUPLICATE') {
            return res.status(409).json({
                error: `Duplicate question detected! This exact question statement already exists in the question bank for "${sanitized.subject}".`,
                status: 'EXACT_DUPLICATE',
                isDuplicate: true,
                matches: duplicateCheck.matches
            });
        }

        // Near Duplicate: Require explicit student confirmation
        if (duplicateCheck.status === 'LIKELY_NEAR_DUPLICATE' && !confirmedDistinct) {
            return res.status(409).json({
                error: 'A likely near-duplicate question was found in the question bank. Please review the matches before submitting.',
                status: 'LIKELY_NEAR_DUPLICATE',
                requiresConfirmation: true,
                matches: duplicateCheck.matches
            });
        }

        // 3. Prevent Race-Condition Insertion (Double Clicks)
        const raceExisting = await PYQ.findOne({
            subject: new RegExp(`^${sanitized.subject}$`, 'i'),
            $or: [
                { paperQuestionKey },
                { question: sanitized.question }
            ]
        }).lean();

        if (raceExisting) {
            return res.status(409).json({
                error: `Duplicate question detected! This question is already saved in the database.`,
                status: 'EXACT_DUPLICATE',
                isDuplicate: true,
                matches: [{
                    id: String(raceExisting._id),
                    question: raceExisting.question,
                    subject: raceExisting.subject,
                    year: raceExisting.year,
                    examType: raceExisting.examType,
                    marks: raceExisting.marks
                }]
            });
        }

        // 4. Create and persist record with strictly enforced student provenance
        const reasoningText = confirmedDistinct
            ? 'Submitted by student with confirmation of distinction despite potential near-duplicate similarity'
            : 'Submitted via Student Portal, pending faculty review';

        const newPYQ = new PYQ({
            subject: sanitized.subject,
            subjectCode: sanitized.subjectCode,
            year: sanitized.year,
            examType: sanitized.examType,
            question: sanitized.question,
            questionNumber: sanitized.questionNumber,
            questionType: sanitized.questionType,
            marks: sanitized.marks,
            unit: sanitized.unit,
            topic: sanitized.topic,
            solution: sanitized.solution,
            difficulty: sanitized.difficulty,
            courseOutcomes: sanitized.courseOutcomes,
            bloomLevel: sanitized.bloomLevel,
            tags: sanitized.tags,
            origin: 'STUDENT_SUBMITTED',
            reviewStatus: 'PENDING',
            isVerified: false,
            isPredicted: false,
            frequency: 1,
            predictionReasoning: reasoningText,
            paperQuestionKey,
            addedBy: currentUserId
        });

        await newPYQ.save();

        res.status(201).json({
            message: `Question submitted for faculty review! Your submission for "${sanitized.subject}" is marked as PENDING and will be reviewed before inclusion in historical repetition analysis.`,
            pyq: newPYQ,
            reviewStatus: 'PENDING',
            origin: 'STUDENT_SUBMITTED',
            isVerified: false
        });
    } catch (error) {
        console.error('Error introducing PYQ from portal:', error);
        res.status(500).json({ error: error.message || 'Failed to introduce question' });
    }
};
