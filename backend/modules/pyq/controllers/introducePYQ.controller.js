import PYQ from '../../../models/pyq.model.js';

/**
 * Normalizes question text for duplicate detection
 */
function normalizeQuestionText(text) {
    return (text || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

/**
 * Introduce a single Previous Year Question from the Portal
 * 
 * Enforces strict validation, duplicate detection, and explicit
 * origin: 'STUDENT_SUBMITTED' / reviewStatus: 'PENDING'
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
            tags
        } = req.body;

        // 1. Validation
        if (!subject || typeof subject !== 'string' || subject.trim().length < 2) {
            return res.status(400).json({ error: 'Valid subject name is required (minimum 2 characters)' });
        }

        const trimmedQuestion = (question || '').trim();
        if (!trimmedQuestion || trimmedQuestion.length < 15) {
            return res.status(400).json({ error: 'Question statement is too short. Please provide a complete examination question statement (minimum 15 characters).' });
        }

        const currentYear = new Date().getFullYear();
        const parsedYear = parseInt(year);
        if (isNaN(parsedYear) || parsedYear < 1990 || parsedYear > currentYear + 2) {
            return res.status(400).json({ error: `Exam year must be a valid year between 1990 and ${currentYear + 2}` });
        }

        const parsedMarks = parseInt(marks);
        if (isNaN(parsedMarks) || parsedMarks < 1 || parsedMarks > 30) {
            return res.status(400).json({ error: 'Marks must be an integer between 1 and 30' });
        }

        const validDifficulties = ['Easy', 'Medium', 'Hard'];
        const normalizedDifficulty = validDifficulties.find(d => d.toLowerCase() === (difficulty || '').toLowerCase()) || 'Medium';

        const validBloomLevels = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'];
        let sanitizedBloom = null;
        if (bloomLevel && validBloomLevels.includes(String(bloomLevel).toUpperCase().trim())) {
            sanitizedBloom = String(bloomLevel).toUpperCase().trim();
        }

        // Process Course Outcomes (CO1..CO6)
        let sanitizedCOs = [];
        if (Array.isArray(courseOutcomes)) {
            sanitizedCOs = courseOutcomes.map(c => String(c).toUpperCase().trim()).filter(c => /^CO[1-6]$/i.test(c));
        } else if (typeof courseOutcomes === 'string' && courseOutcomes.trim()) {
            sanitizedCOs = courseOutcomes.split(',').map(c => c.toUpperCase().trim()).filter(c => /^CO[1-6]$/i.test(c));
        }

        // Process Tags
        let processedTags = [];
        if (Array.isArray(tags)) {
            processedTags = tags.map(t => String(t).trim()).filter(Boolean);
        } else if (typeof tags === 'string' && tags.trim()) {
            processedTags = tags.split(',').map(t => t.trim()).filter(Boolean);
        }

        // 2. Duplicate Detection
        // Check if an identical or near-identical question statement already exists in the same subject
        const normalizedInput = normalizeQuestionText(trimmedQuestion);
        const subjectRegex = new RegExp(`^${subject.trim()}$`, 'i');

        const existingSubjectQuestions = await PYQ.find({
            subject: subjectRegex
        }).select('question year examType').lean();

        const isDuplicate = existingSubjectQuestions.some(existing => {
            const normExisting = normalizeQuestionText(existing.question);
            return normExisting === normalizedInput;
        });

        if (isDuplicate) {
            return res.status(409).json({
                error: `Duplicate question detected! This exact question statement already exists in the question bank for "${subject.trim()}".`
            });
        }

        // 3. Create Record with Explicit Provenance and Pending Review
        const newPYQ = new PYQ({
            subject: subject.trim(),
            subjectCode: (subjectCode || '').trim(),
            year: parsedYear,
            examType: (examType || 'End-Sem').trim(),
            question: trimmedQuestion,
            questionNumber: (questionNumber || '').trim(),
            questionType: (questionType || 'Subjective').trim(),
            marks: parsedMarks,
            unit: (unit || 'Unit 1').trim(),
            topic: (topic || 'General').trim(),
            solution: (solution || '').trim(),
            difficulty: normalizedDifficulty,
            courseOutcomes: sanitizedCOs,
            bloomLevel: sanitizedBloom,
            origin: 'STUDENT_SUBMITTED',
            reviewStatus: 'PENDING',
            isVerified: false,
            isPredicted: false,
            frequency: 1,
            tags: processedTags,
            addedBy: req.user?._id || req.user?.userId
        });

        await newPYQ.save();

        res.status(201).json({
            message: `Question submitted for faculty review! Your submission for "${subject.trim()}" is marked as PENDING and will be reviewed before inclusion in historical repetition analysis.`,
            pyq: newPYQ,
            reviewStatus: 'PENDING',
            origin: 'STUDENT_SUBMITTED'
        });
    } catch (error) {
        console.error('Error introducing PYQ from portal:', error);
        res.status(500).json({ error: error.message || 'Failed to introduce question' });
    }
};
