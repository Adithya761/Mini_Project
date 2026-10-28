import { predictPYQsFromHistoricalData } from '../../../services/pyqPrediction.service.js';

/**
 * Predict high-probability examination questions grounded in authentic historical PYQs,
 * recurrence across distinct examination sessions, and CO/PO/Bloom evidence.
 */
export const predictPYQ = async (req, res) => {
    try {
        const {
            subject,
            targetExam,
            topics,
            count,
            difficulty,
            syllabusText
        } = req.body;

        if (!subject || !subject.trim()) {
            return res.status(400).json({ error: 'Subject name is required for prediction' });
        }

        const predictions = await predictPYQsFromHistoricalData({
            subject: subject.trim(),
            targetExam: targetExam || 'End-Sem 2026',
            topics: topics || '',
            count: parseInt(count) || 5,
            difficulty: difficulty || 'Medium',
            syllabusText: syllabusText || ''
        });

        res.json({
            subject: subject.trim(),
            targetExam: targetExam || 'End-Sem 2026',
            count: predictions.length,
            predictions
        });
    } catch (error) {
        console.error('Predict PYQ Controller Error:', error);
        res.status(500).json({ error: error.message || 'Failed to predict questions' });
    }
};
