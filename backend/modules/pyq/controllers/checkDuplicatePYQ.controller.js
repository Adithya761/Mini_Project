import { validateQuestionInput, detectDuplicates } from '../../../services/pyqDuplicate.service.js';

/**
 * Controller to check if a question is an exact or near-duplicate
 * before student submission.
 *
 * This endpoint is read-only and NEVER inserts or modifies any records.
 */
export const checkDuplicatePYQ = async (req, res) => {
    try {
        const {
            subject,
            question,
            year,
            marks,
            unit,
            topic,
            difficulty,
            excludeId
        } = req.body;

        // 1. Validate fields
        const validation = validateQuestionInput({
            subject,
            question,
            year,
            marks,
            unit,
            topic,
            difficulty
        });

        if (!validation.isValid) {
            return res.status(400).json({
                status: 'INVALID',
                isDuplicate: false,
                requiresReview: false,
                matches: [],
                validationErrors: validation.errors,
                message: validation.errors[0] || 'Invalid question parameters'
            });
        }

        // 2. Perform duplicate detection against database
        const duplicateResult = await detectDuplicates({
            subject: validation.sanitized.subject,
            question: validation.sanitized.question,
            excludeId
        });

        res.json({
            status: duplicateResult.status,
            isDuplicate: duplicateResult.isDuplicate,
            requiresReview: duplicateResult.requiresReview,
            matches: duplicateResult.matches,
            validationErrors: [],
            message: duplicateResult.message
        });
    } catch (error) {
        console.error('Error checking duplicate PYQ:', error);
        res.status(500).json({
            status: 'ERROR',
            isDuplicate: false,
            requiresReview: false,
            matches: [],
            validationErrors: [error.message],
            message: error.message || 'Internal error while checking for duplicates'
        });
    }
};
