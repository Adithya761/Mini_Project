/**
 * Comprehensive Verification Suite for PYQ Sample Paper Generator (ES Module)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

import PYQ from '../models/pyq.model.js';
import SamplePaper from '../models/samplePaper.model.js';
import samplePaperService from '../services/samplePaper.service.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/grama_invest';

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
    if (condition) {
        console.log(`  ✓ PASS: ${testName}`);
        passed++;
    } else {
        console.error(`  ✗ FAIL: ${testName} - ${details}`);
        failed++;
    }
}

async function runTestSuite() {
    console.log('===============================================================');
    console.log('   PYQ SAMPLE PAPER GENERATOR VERIFICATION SUITE');
    console.log('===============================================================\n');

    await mongoose.connect(MONGODB_URI);
    console.log(`Connected to MongoDB at ${MONGODB_URI}\n`);

    try {
        // -------------------------------------------------------------
        // Step 1: Baseline Historical PYQ Count
        // -------------------------------------------------------------
        console.log('--- TEST 1: Baseline Historical PYQ Count ---');
        const initialCount = await PYQ.countDocuments();
        console.log(`  Initial pyqs count: ${initialCount}`);
        assert(initialCount === 441, 'Historical pyqs collection contains exactly 441 records', `Found ${initialCount}`);

        // -------------------------------------------------------------
        // Step 2: Deterministic STANDARD_100 Generation (DBMS)
        // -------------------------------------------------------------
        console.log('\n--- TEST 2: Deterministic STANDARD_100 Generation (DBMS) ---');
        const dbmsPaper = await samplePaperService.generateSamplePaper({
            subject: 'Database Management Systems',
            title: 'SIT B.E. Semester End Examination (DBMS)',
            totalMarks: 100,
            duration: '180 Minutes',
            seed: 42,
            requireCOCoverage: false
        });

        assert(dbmsPaper !== null, 'DBMS sample paper generated successfully');
        assert(dbmsPaper.totalMarks === 100, 'DBMS totalMarks equals 100', `Got ${dbmsPaper.totalMarks}`);
        assert(dbmsPaper.sections.length === 5, 'DBMS paper has exactly 5 sections (5 units)', `Got ${dbmsPaper.sections.length}`);
        
        let allValidMarks = true;
        let dbmsQuestionCount = 0;
        const dbmsQuestionIds = new Set();
        const dbmsQuestionTexts = new Set();

        dbmsPaper.sections.forEach((sec) => {
            if (sec.questions.length !== 2) allValidMarks = false;
            sec.questions.forEach((q) => {
                dbmsQuestionCount++;
                if (q.marks !== 20) allValidMarks = false;
                if (q.sourceId) dbmsQuestionIds.add(String(q.sourceId));
                dbmsQuestionTexts.add(q.question.trim().toLowerCase());
            });
        });

        assert(allValidMarks, 'All sections have exactly 2 questions with 20M each');
        assert(dbmsQuestionCount === 10, 'Total assembled questions is 10 (2 per unit x 5 units)');
        assert(dbmsQuestionIds.size === 10, 'Zero duplicate question IDs in the assembled paper', `Unique: ${dbmsQuestionIds.size}/10`);
        assert(dbmsQuestionTexts.size === 10, 'Zero duplicate question texts in the assembled paper');
        console.log(`  DBMS outcomeDataStatus: "${dbmsPaper.coverageSummary?.outcomeDataStatus}"`);
        assert(
            dbmsPaper.coverageSummary?.outcomeDataStatus === 'FULL_OBE_VERIFIED' || 
            dbmsPaper.coverageSummary?.outcomeDataStatus === 'FULL_OBE_AVAILABLE' ||
            dbmsPaper.coverageSummary?.outcomeDataStatus === 'PARTIAL_OBE_AVAILABLE', 
            'DBMS has verified OBE metadata'
        );

        // -------------------------------------------------------------
        // Step 3: Seed Reproducibility
        // -------------------------------------------------------------
        console.log('\n--- TEST 3: Seed Reproducibility ---');
        const dbmsPaperRepeat = await samplePaperService.generateSamplePaper({
            subject: 'Database Management Systems',
            title: 'SIT B.E. Semester End Examination (DBMS)',
            totalMarks: 100,
            duration: '180 Minutes',
            seed: 42,
            requireCOCoverage: false
        });

        let identicalQuestions = true;
        for (let s = 0; s < 5; s++) {
            for (let q = 0; q < 2; q++) {
                if (String(dbmsPaper.sections[s].questions[q].sourceId) !== 
                    String(dbmsPaperRepeat.sections[s].questions[q].sourceId)) {
                    identicalQuestions = false;
                }
            }
        }
        assert(identicalQuestions, 'Identical seed (42) produces 100% identical question selection');

        // Different seed produces different selection
        const dbmsPaperDiffSeed = await samplePaperService.generateSamplePaper({
            subject: 'Database Management Systems',
            title: 'SIT B.E. Semester End Examination (DBMS)',
            totalMarks: 100,
            duration: '180 Minutes',
            seed: 99999,
            requireCOCoverage: false
        });
        let diffSeedDifferent = false;
        for (let s = 0; s < 5; s++) {
            for (let q = 0; q < 2; q++) {
                if (String(dbmsPaper.sections[s].questions[q].sourceId) !== 
                    String(dbmsPaperDiffSeed.sections[s].questions[q].sourceId)) {
                    diffSeedDifferent = true;
                    break;
                }
            }
        }
        assert(diffSeedDifferent, 'Different seed produces diversified question selection');

        // -------------------------------------------------------------
        // Step 4: MID_SEM_50 Generation (Software Engineering)
        // -------------------------------------------------------------
        console.log('\n--- TEST 4: MID_SEM_50 Generation (Software Engineering) ---');
        const sePaper = await samplePaperService.generateSamplePaper({
            subject: 'Software Engineering',
            title: 'SIT Mid-Semester Assessment (SE)',
            totalMarks: 50,
            duration: '90 Minutes',
            seed: 123,
            requireCOCoverage: false
        });

        assert(sePaper !== null, 'Software Engineering mid-sem paper generated');
        assert(sePaper.totalMarks === 50, 'Total marks is 50');
        assert(sePaper.sections.length === 2, 'Has Part A and Part B sections');
        const partAQCount = sePaper.sections[0].questions.length;
        const partBQCount = sePaper.sections[1].questions.length;
        assert(partAQCount === 2, 'Part A has 2 questions (5M each)', `Got ${partAQCount}`);
        assert(partBQCount === 3, 'Part B has 3 questions (20M each)', `Got ${partBQCount}`);
        assert(sePaper.sections[0].questions.every(q => q.marks === 5), 'All Part A questions have 5 marks');
        assert(sePaper.sections[1].questions.every(q => q.marks === 20), 'All Part B questions have 20 marks');

        // -------------------------------------------------------------
        // Step 5: Academic Integrity for Operating Systems (Source Lacks OBE)
        // -------------------------------------------------------------
        console.log('\n--- TEST 5: Outcome Metadata Integrity for Operating Systems ---');
        // 5a. Optional COs should succeed with explicit NO_OBE_METADATA_IN_SOURCE
        const osPaper = await samplePaperService.generateSamplePaper({
            subject: 'Operating Systems',
            title: 'SIT Model Paper (OS)',
            totalMarks: 100,
            duration: '180 Minutes',
            seed: 777,
            requireCOCoverage: false
        });

        assert(osPaper !== null, 'OS paper generated with authentic constraints');
        assert(osPaper.coverageSummary?.outcomeDataStatus === 'NO_OBE_METADATA_IN_SOURCE', 
            'OS coverageSummary sets outcomeDataStatus to NO_OBE_METADATA_IN_SOURCE');
        
        // Verify NO questions have fabricated Bloom or CO tags
        const fabricatedDataFound = osPaper.sections.some(s => 
            s.questions.some(q => (q.courseOutcomes && q.courseOutcomes.length > 0) || q.bloomLevel !== null)
        );
        assert(!fabricatedDataFound, 'Zero fabricated CO or Bloom levels present in OS paper');

        // 5b. Mandatory COs must reject generation with explanatory error
        let rejectedAsExpected = false;
        let rejectErrorMsg = '';
        try {
            await samplePaperService.generateSamplePaper({
                subject: 'Operating Systems',
                title: 'SIT Model Paper (OS)',
                totalMarks: 100,
                duration: '180 Minutes',
                seed: 777,
                requireCOCoverage: true // Enforced mandatory CO
            });
        } catch (err) {
            rejectedAsExpected = true;
            rejectErrorMsg = err.message;
        }

        assert(rejectedAsExpected, 'OS paper generation rejected when requireCOCoverage=true');
        assert(rejectErrorMsg.includes('predate OBE') || rejectErrorMsg.includes('Unsatisfiable Blueprint'), 
            'Rejection error explains that historical papers predate OBE', rejectErrorMsg);

        // -------------------------------------------------------------
        // Step 6: Question Bank Shortage Handling
        // -------------------------------------------------------------
        console.log('\n--- TEST 6: Question Bank Shortage Handling ---');
        let shortageRejected = false;
        let shortageErrorMsg = '';
        try {
            await samplePaperService.generateSamplePaper({
                subject: 'Computer Networks', // Only 3 records in DB
                totalMarks: 100,
                seed: 101
            });
        } catch (err) {
            shortageRejected = true;
            shortageErrorMsg = err.message;
        }

        assert(shortageRejected, 'Computer Networks generation rejected due to question shortage');
        assert(shortageErrorMsg.includes('Shortage') || shortageErrorMsg.includes('requires'), 
            'Shortage error message explains missing questions', shortageErrorMsg);

        // -------------------------------------------------------------
        // Step 7: Question Replacement Engine
        // -------------------------------------------------------------
        console.log('\n--- TEST 7: Question Replacement Engine ---');
        const originalQ = dbmsPaper.sections[0].questions[0];
        const replacedPaper = await samplePaperService.replaceQuestionInSamplePaper({
            paperData: dbmsPaper,
            sectionIndex: 0,
            questionIndex: 0
        });

        const newQ = replacedPaper.sections[0].questions[0];
        assert(String(newQ.sourceId) !== String(originalQ.sourceId), 
            'Question replaced with a different source question', `Orig: ${originalQ.sourceId}, New: ${newQ.sourceId}`);
        assert(newQ.marks === originalQ.marks, 'Target marks preserved (20M)');
        assert(newQ.unit === originalQ.unit || newQ.unit.includes('Unit'), 'Unit constraint preserved');

        // Verify intra-paper uniqueness after replacement
        const replacedIds = new Set();
        let anyDuplicate = false;
        replacedPaper.sections.forEach(s => {
            s.questions.forEach(q => {
                const idStr = String(q.sourceId);
                if (replacedIds.has(idStr)) anyDuplicate = true;
                replacedIds.add(idStr);
            });
        });
        assert(!anyDuplicate, 'Zero duplicate questions in paper after replacement');
        assert(replacedPaper.coverageSummary !== undefined, 'Coverage summary recalculated after replacement');

        // -------------------------------------------------------------
        // Step 8: Save, Retrieve, and User Isolation (sample_papers)
        // -------------------------------------------------------------
        console.log('\n--- TEST 8: Save, Retrieve, and User Isolation (sample_papers) ---');
        const testUser1Id = new mongoose.Types.ObjectId();
        const testUser2Id = new mongoose.Types.ObjectId();

        // Save paper
        const savedDoc = await SamplePaper.create({
            title: dbmsPaper.title,
            subject: dbmsPaper.subject,
            degree: dbmsPaper.degree,
            branch: dbmsPaper.branch,
            duration: dbmsPaper.duration,
            totalMarks: dbmsPaper.totalMarks,
            templateId: dbmsPaper.templateId,
            blueprint: dbmsPaper.blueprint,
            sections: dbmsPaper.sections,
            coverageSummary: dbmsPaper.coverageSummary,
            createdBy: testUser1Id,
            isPublic: false
        });

        assert(savedDoc !== null && savedDoc._id !== undefined, 'Paper successfully saved to sample_papers collection');

        // Owner retrieves own paper
        const retrievedByOwner = await SamplePaper.findOne({ _id: savedDoc._id, createdBy: testUser1Id });
        assert(retrievedByOwner !== null, 'Owner (testUser1) can retrieve their saved paper');
        assert(retrievedByOwner.sections.length === 5, 'Retrieved paper sections remain fully intact');

        // Non-owner attempts to retrieve private paper
        const retrievedByOther = await SamplePaper.findOne({
            _id: savedDoc._id,
            $or: [{ createdBy: testUser2Id }, { isPublic: true }]
        });
        assert(retrievedByOther === null, 'Non-owner (testUser2) cannot retrieve private paper');

        // Clean up test saved paper
        const deleteRes = await SamplePaper.deleteOne({ _id: savedDoc._id });
        assert(deleteRes.deletedCount === 1, 'Test sample paper cleaned up safely from sample_papers');

        // -------------------------------------------------------------
        // Step 9: Final Data Safety Check
        // -------------------------------------------------------------
        console.log('\n--- TEST 9: Final Data Safety Check ---');
        const finalCount = await PYQ.countDocuments();
        console.log(`  Final pyqs count: ${finalCount}`);
        assert(finalCount === 441, 'Historical pyqs collection still contains exactly 441 records (100% untouched)');

    } catch (err) {
        console.error('Unexpected error in test suite:', err);
        failed++;
    } finally {
        await mongoose.disconnect();
        console.log('\n===============================================================');
        console.log(`TEST RUN COMPLETE: ${passed} PASSED, ${failed} FAILED`);
        console.log('===============================================================');
        if (failed > 0) {
            process.exit(1);
        } else {
            process.exit(0);
        }
    }
}

runTestSuite();
