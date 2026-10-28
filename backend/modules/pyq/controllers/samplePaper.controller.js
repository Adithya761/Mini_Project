import SamplePaper from '../../../models/samplePaper.model.js';
import {
    generateSamplePaperService,
    replaceQuestionInSamplePaper,
    DEFAULT_EXAM_TEMPLATES
} from '../../../services/samplePaper.service.js';

/**
 * Generate a complete examination sample paper adhering to blueprint constraints
 */
export const generateSamplePaper = async (req, res) => {
    try {
        const {
            subject,
            title,
            duration,
            totalMarks,
            sourcePolicy,
            requireCOCoverage,
            coDistribution,
            difficultyDistribution,
            sectionConfigs,
            seed
        } = req.body;

        if (!subject || !subject.trim()) {
            return res.status(400).json({ error: 'Subject is required to generate a sample paper.' });
        }

        const samplePaper = await generateSamplePaperService({
            subject: subject.trim(),
            title: title ? title.trim() : undefined,
            duration: duration ? duration.trim() : undefined,
            totalMarks: parseInt(totalMarks) || 100,
            sourcePolicy: sourcePolicy || 'HISTORICAL_ONLY',
            requireCOCoverage: Boolean(requireCOCoverage),
            coDistribution: coDistribution || {},
            difficultyDistribution: difficultyDistribution || { Easy: 30, Medium: 50, Hard: 20 },
            sectionConfigs: Array.isArray(sectionConfigs) && sectionConfigs.length > 0 ? sectionConfigs : null,
            userId: req.user?._id || req.user?.id || req.user?.userId,
            seed: seed !== undefined ? parseInt(seed) : 42
        });

        res.json({
            message: 'Sample paper generated successfully!',
            samplePaper
        });
    } catch (error) {
        console.error('Error generating sample paper:', error.message);
        res.status(400).json({ error: error.message });
    }
};

/**
 * Replace a single question with a valid alternative
 */
export const replaceQuestion = async (req, res) => {
    try {
        const { paperData, sectionIndex, questionIndex } = req.body;

        if (!paperData || sectionIndex === undefined || questionIndex === undefined) {
            return res.status(400).json({ error: 'Missing paperData, sectionIndex, or questionIndex.' });
        }

        const updatedPaper = await replaceQuestionInSamplePaper({
            paperData,
            sectionIndex: parseInt(sectionIndex),
            questionIndex: parseInt(questionIndex)
        });

        res.json({
            message: 'Question replaced successfully!',
            samplePaper: updatedPaper
        });
    } catch (error) {
        console.error('Error replacing question:', error.message);
        res.status(400).json({ error: error.message });
    }
};

/**
 * Save a generated sample paper to the dedicated sample_papers collection
 */
export const saveSamplePaper = async (req, res) => {
    try {
        const paperData = req.body.samplePaper || req.body;
        const userId = req.user?._id || req.user?.id || req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required to save sample papers.' });
        }

        if (!paperData.subject || !paperData.sections || paperData.sections.length === 0) {
            return res.status(400).json({ error: 'Invalid sample paper data. Must contain subject and sections.' });
        }

        // Clean any existing ID if resaving as new document
        const { _id, createdAt, updatedAt, ...cleanData } = paperData;

        const newSamplePaper = new SamplePaper({
            ...cleanData,
            createdBy: userId,
            status: 'FINALIZED'
        });

        await newSamplePaper.save();

        res.status(201).json({
            message: 'Sample paper saved successfully to your dedicated archive!',
            samplePaper: newSamplePaper
        });
    } catch (error) {
        console.error('Error saving sample paper:', error.message);
        res.status(500).json({ error: error.message || 'Failed to save sample paper' });
    }
};

/**
 * Retrieve saved sample papers for the authenticated user
 */
export const getSavedSamplePapers = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id || req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required to fetch saved sample papers.' });
        }

        const papers = await SamplePaper.find({ createdBy: userId })
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            count: papers.length,
            samplePapers: papers
        });
    } catch (error) {
        console.error('Error fetching saved sample papers:', error.message);
        res.status(500).json({ error: error.message || 'Failed to fetch sample papers' });
    }
};

/**
 * Get a specific sample paper by ID
 */
export const getSamplePaperById = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id || req.user?.userId;
        const paper = await SamplePaper.findById(req.params.id).lean();

        if (!paper) {
            return res.status(404).json({ error: 'Sample paper not found.' });
        }

        // Access check: if paper belongs to another user and requester is authenticated
        if (paper.createdBy && String(paper.createdBy) !== String(userId) && req.user?.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized to view this private sample paper.' });
        }

        res.json({ samplePaper: paper });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Delete a saved sample paper (Enforces ownership verification)
 */
export const deleteSamplePaper = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id || req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required to delete sample papers.' });
        }

        const deleted = await SamplePaper.findOneAndDelete({
            _id: req.params.id,
            createdBy: userId
        });

        if (!deleted) {
            return res.status(404).json({ error: 'Sample paper not found or unauthorized to delete.' });
        }

        res.json({ message: 'Sample paper deleted successfully from your collection.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get standard blueprint templates
 */
export const getBlueprintTemplates = (req, res) => {
    res.json({
        templates: Object.values(DEFAULT_EXAM_TEMPLATES),
        templateMap: DEFAULT_EXAM_TEMPLATES
    });
};

