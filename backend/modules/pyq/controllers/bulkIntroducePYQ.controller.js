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
 * Bulk introduce multiple Previous Year Questions from the Portal (Batch Ingestion)
 *
 * Enforces validation, duplicate detection (both internal to batch and DB),
 * and sets provenance appropriately based on user role:
 * - Admin users: Allowed to import historical batches with explicit origin / reviewStatus
 * - Students: Strictly enforced origin: 'STUDENT_SUBMITTED', reviewStatus: 'PENDING', isVerified: false
 */
export const bulkIntroducePYQ = async (req, res) => {
    try {
        const { questions, defaultSubject, defaultYear, defaultExamType } = req.body;
        const currentUserId = req.user?._id || req.user?.id || req.user?.userId;
        const isAdmin = req.user?.role === 'admin';

        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: 'Please provide an array of questions to introduce' });
        }

        const currentYear = new Date().getFullYear();
        const validQuestions = [];
        const seenInBatch = new Set();
        let internalDuplicatesCount = 0;
        let dbDuplicatesCount = 0;
        let malformedCount = 0;

        // Fetch existing questions to detect duplicates in DB
        const existingDocs = await PYQ.find({}).select('subject question').lean();
        const existingNormSet = new Set(
            existingDocs.map(d => `${d.subject.toLowerCase()}_${normalizeQuestionText(d.question)}`)
        );

        const validDifficulties = ['Easy', 'Medium', 'Hard'];
        const validBloomLevels = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'];

        for (const item of questions) {
            const subject = (item.subject || defaultSubject || '').trim();
            const question = (item.question || '').trim();

            // Validate question statement & subject
            if (!subject || subject.length < 2 || !question || question.length < 15) {
                malformedCount++;
                continue;
            }

            const normKey = `${subject.toLowerCase()}_${normalizeQuestionText(question)}`;

            // Check intra-batch duplicate
            if (seenInBatch.has(normKey)) {
                internalDuplicatesCount++;
                continue;
            }
            seenInBatch.add(normKey);

            // Check database duplicate
            if (existingNormSet.has(normKey)) {
                dbDuplicatesCount++;
                continue;
            }

            let tags = [];
            if (Array.isArray(item.tags)) {
                tags = item.tags.map(t => String(t).trim()).filter(Boolean);
            } else if (typeof item.tags === 'string' && item.tags.trim()) {
                tags = item.tags.split(',').map(t => t.trim()).filter(Boolean);
            }

            // Sanitize COs
            let sanitizedCOs = [];
            if (Array.isArray(item.courseOutcomes)) {
                sanitizedCOs = item.courseOutcomes.map(c => String(c).toUpperCase().trim()).filter(c => /^CO[1-6]$/i.test(c));
            } else if (typeof item.courseOutcomes === 'string' && item.courseOutcomes.trim()) {
                sanitizedCOs = item.courseOutcomes.split(',').map(c => c.toUpperCase().trim()).filter(c => /^CO[1-6]$/i.test(c));
            }

            // Sanitize Bloom
            let sanitizedBloom = null;
            if (item.bloomLevel && validBloomLevels.includes(String(item.bloomLevel).toUpperCase().trim())) {
                sanitizedBloom = String(item.bloomLevel).toUpperCase().trim();
            }

            const parsedYear = parseInt(item.year) || parseInt(defaultYear) || currentYear;
            const parsedMarks = parseInt(item.marks) || 5;
            const difficulty = validDifficulties.find(d => d.toLowerCase() === (item.difficulty || '').toLowerCase()) || 'Medium';

            // Provenance configuration based on authorization
            const origin = isAdmin && item.origin ? item.origin : 'STUDENT_SUBMITTED';
            const reviewStatus = isAdmin && item.reviewStatus ? item.reviewStatus : 'PENDING';
            const isVerified = isAdmin && typeof item.isVerified === 'boolean' ? item.isVerified : false;

            validQuestions.push({
                subject,
                subjectCode: (item.subjectCode || '').trim(),
                year: parsedYear,
                examType: (item.examType || defaultExamType || 'End-Sem').trim(),
                question,
                questionNumber: (item.questionNumber || '').trim(),
                questionType: (item.questionType || 'Subjective').trim(),
                marks: (parsedMarks >= 1 && parsedMarks <= 30) ? parsedMarks : 5,
                unit: (item.unit || 'Unit 1').trim(),
                topic: (item.topic || 'General').trim(),
                solution: (item.solution || '').trim(),
                difficulty,
                courseOutcomes: sanitizedCOs,
                bloomLevel: sanitizedBloom,
                origin,
                reviewStatus,
                isVerified,
                isPredicted: false,
                frequency: 1,
                tags,
                addedBy: currentUserId
            });
        }

        if (validQuestions.length === 0) {
            return res.status(400).json({
                error: `No new valid questions to introduce. (Malformed: ${malformedCount}, Database duplicates: ${dbDuplicatesCount}, Batch duplicates: ${internalDuplicatesCount})`
            });
        }

        const inserted = await PYQ.insertMany(validQuestions);

        const statusMessage = isAdmin
            ? `Successfully ingested ${inserted.length} question(s)! (Duplicates skipped: ${dbDuplicatesCount + internalDuplicatesCount}).`
            : `Successfully submitted ${inserted.length} question(s) for faculty review! (Marked as PENDING approval; duplicates skipped: ${dbDuplicatesCount + internalDuplicatesCount}).`;

        res.status(201).json({
            message: statusMessage,
            count: inserted.length,
            insertedCount: inserted.length,
            dbDuplicatesSkipped: dbDuplicatesCount,
            batchDuplicatesSkipped: internalDuplicatesCount,
            malformedSkipped: malformedCount,
            reviewStatus: isAdmin ? 'PROCESSED' : 'PENDING',
            origin: isAdmin ? 'BATCH_IMPORT' : 'STUDENT_SUBMITTED'
        });
    } catch (error) {
        console.error('Error bulk introducing PYQs from portal:', error);
        res.status(500).json({ error: error.message || 'Failed to bulk introduce questions' });
    }
};
