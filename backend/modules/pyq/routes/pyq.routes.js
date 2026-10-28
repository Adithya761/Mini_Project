import { Router } from 'express';
import jwt from 'jsonwebtoken';
import * as authMiddleware from '../../../middlewares/auth.middleware.js';

// Modular controllers
import { introducePYQ } from '../controllers/introducePYQ.controller.js';
import { bulkIntroducePYQ } from '../controllers/bulkIntroducePYQ.controller.js';
import { checkDuplicatePYQ } from '../controllers/checkDuplicatePYQ.controller.js';
import { getPYQs, getPYQById } from '../controllers/getPYQs.controller.js';
import { getSubjects } from '../controllers/getSubjects.controller.js';
import { predictPYQ } from '../controllers/predictPYQ.controller.js';
import { savePredictedPYQ } from '../controllers/savePredictedPYQ.controller.js';
import { updatePYQ, deletePYQ, toggleBookmark, toggleSolved } from '../controllers/managePYQ.controller.js';

const router = Router();

// Middleware that attaches user context if token exists, without rejecting unauthenticated read
const optionalAuth = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
        }
    } catch {
        // Continue for public read
    }
    next();
};

// ========================================================
// PORTAL QUESTION INTRODUCTION & DUPLICATE CHECK ROUTES
// ========================================================
// Check duplicate before submission (read-only)
router.post('/check-duplicate', authMiddleware.authUser, checkDuplicatePYQ);

// Introduce a single question from the portal
router.post('/introduce', authMiddleware.authUser, introducePYQ);
// Also support POST / for backward compatibility
router.post('/', authMiddleware.authUser, introducePYQ);

// Bulk introduce / batch import from the portal
router.post('/bulk-introduce', authMiddleware.authUser, bulkIntroducePYQ);

import {
    generateSamplePaper,
    replaceQuestion,
    saveSamplePaper,
    getSavedSamplePapers,
    getSamplePaperById,
    deleteSamplePaper,
    getBlueprintTemplates
} from '../controllers/samplePaper.controller.js';

// ========================================================
// SAMPLE PAPER GENERATOR ROUTES
// ========================================================
router.get('/sample-paper/templates', optionalAuth, getBlueprintTemplates);
router.get('/sample-paper/saved', authMiddleware.authUser, getSavedSamplePapers);
router.get('/sample-paper/:id', optionalAuth, getSamplePaperById);
router.post('/sample-paper/generate', authMiddleware.authUser, generateSamplePaper);
router.post('/sample-paper/replace-question', authMiddleware.authUser, replaceQuestion);
router.post('/sample-paper/save', authMiddleware.authUser, saveSamplePaper);
router.delete('/sample-paper/:id', authMiddleware.authUser, deleteSamplePaper);

// ========================================================
// QUESTION BANK BROWSING & STATS ROUTES
// ========================================================
router.get('/', optionalAuth, getPYQs);
router.get('/subjects', optionalAuth, getSubjects);
router.get('/:id', optionalAuth, getPYQById);

// ========================================================
// AI PREDICTION ENGINE ROUTES
// ========================================================
router.post('/predict', authMiddleware.authUser, predictPYQ);
router.post('/save-predicted', authMiddleware.authUser, savePredictedPYQ);

// ========================================================
// MANAGEMENT & INTERACTION ROUTES
// ========================================================
router.put('/:id', authMiddleware.authUser, updatePYQ);
router.delete('/:id', authMiddleware.authUser, deletePYQ);
router.post('/:id/bookmark', authMiddleware.authUser, toggleBookmark);
router.post('/:id/solve', authMiddleware.authUser, toggleSolved);

export default router;
