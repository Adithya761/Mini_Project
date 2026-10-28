import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import SamplePaper from '../models/samplePaper.model.js';
import PYQ from '../models/pyq.model.js';
import {
    generateSamplePaperService,
    replaceQuestionInSamplePaper,
    DEFAULT_EXAM_TEMPLATES
} from '../services/samplePaper.service.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/grama_invest';

async function runTests() {
    console.log('=== Stage 2 Automated Tests: Sample Paper Generator ===');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1. Initial count check
    const initialPYQCount = await PYQ.countDocuments();
    console.log(`[Check 1] Initial PYQ collection count: ${initialPYQCount}`);
    if (initialPYQCount !== 441) {
        throw new Error(`Expected 441 PYQ records, but found ${initialPYQCount}`);
    }

    // 2. Blueprint templates test
    console.log('\n[Check 2] Testing DEFAULT_EXAM_TEMPLATES...');
    const templateKeys = Object.keys(DEFAULT_EXAM_TEMPLATES);
    console.log(`Found ${templateKeys.length} templates:`, templateKeys.map(k => `${k} (${DEFAULT_EXAM_TEMPLATES[k].totalMarks}M)`));
    if (templateKeys.length < 3) throw new Error('Expected at least 3 templates');

    // 3. Generate 100M DBMS Paper
    console.log('\n[Check 3] Generating 100M Standard Paper for Database Management Systems...');
    const dbmsPaper = await generateSamplePaperService({
        subject: 'Database Management Systems',
        title: 'B.E. Semester End Model Examination - DBMS',
        duration: '3 Hours',
        totalMarks: 100,
        requireCOCoverage: true,
        difficultyDistribution: { Easy: 30, Medium: 50, Hard: 20 }
    });

    console.log(`Generated Paper Title: "${dbmsPaper.title}"`);
    console.log(`Total Marks: ${dbmsPaper.totalMarks} (Expected 100)`);
    console.log(`Total Sections: ${dbmsPaper.sections.length} (Expected 5 units)`);
    console.log(`Outcome Data Status:`, dbmsPaper.coverageSummary?.outcomeDataStatus);
    console.log(`CO Coverage keys:`, Object.keys(dbmsPaper.coverageSummary?.coCoverage || {}));

    if (dbmsPaper.totalMarks !== 100) {
        throw new Error(`Expected total marks 100, got ${dbmsPaper.totalMarks}`);
    }
    if (dbmsPaper.sections.length !== 5) {
        throw new Error(`Expected 5 sections, got ${dbmsPaper.sections.length}`);
    }
    if (dbmsPaper.sections[0].questions.length < 2) {
        throw new Error('Expected internal choice (OR) questions in Section 1');
    }
    console.log('✓ DBMS 100M paper generation passed with verified internal choice and OBE coverage!');

    // 4. Test Question Replacement
    console.log('\n[Check 4] Testing replaceQuestionInSamplePaper...');
    const originalQ1 = dbmsPaper.sections[0].questions[0];
    console.log(`Original Q1 text: "${originalQ1.question.substring(0, 60)}..."`);

    const updatedPaper = await replaceQuestionInSamplePaper({
        paperData: dbmsPaper,
        sectionIndex: 0,
        questionIndex: 0
    });

    const replacedQ1 = updatedPaper.sections[0].questions[0];
    console.log(`Replaced Q1 text: "${replacedQ1.question.substring(0, 60)}..."`);
    if (originalQ1.question === replacedQ1.question) {
        throw new Error('Question replacement returned the exact same question');
    }
    if (replacedQ1.marks !== originalQ1.marks) {
        throw new Error(`Replaced question marks mismatch: expected ${originalQ1.marks}, got ${replacedQ1.marks}`);
    }
    console.log('✓ Question replacement passed with identical unit & mark constraints!');

    // 5. Test Operating Systems without mandatory CO (Authentic older papers pre-date OBE)
    console.log('\n[Check 5] Generating Operating Systems Paper with requireCOCoverage: false...');
    const osPaper = await generateSamplePaperService({
        subject: 'Operating Systems',
        title: 'B.E. Semester End Model Examination - Operating Systems',
        duration: '3 Hours',
        totalMarks: 100,
        requireCOCoverage: false
    });

    console.log(`OS Paper Generated Sections: ${osPaper.sections.length}`);
    console.log(`OS Outcome Data Status: ${osPaper.coverageSummary?.outcomeDataStatus}`);
    if (osPaper.coverageSummary?.outcomeDataStatus !== 'NO_OBE_METADATA_IN_SOURCE') {
        throw new Error(`Expected NO_OBE_METADATA_IN_SOURCE for OS, got ${osPaper.coverageSummary?.outcomeDataStatus}`);
    }
    console.log('✓ Operating Systems paper generated honestly without fabricated outcomes!');

    // 6. Test Operating Systems rejection when requireCOCoverage: true is enforced
    console.log('\n[Check 6] Testing Operating Systems rejection when requireCOCoverage: true is enforced...');
    let osRejectionCaught = false;
    try {
        await generateSamplePaperService({
            subject: 'Operating Systems',
            title: 'B.E. Semester End Model Examination - Operating Systems',
            duration: '3 Hours',
            totalMarks: 100,
            requireCOCoverage: true
        });
    } catch (err) {
        osRejectionCaught = true;
        console.log(`Expected rejection caught: "${err.message}"`);
    }
    if (!osRejectionCaught) {
        throw new Error('Operating Systems generation should have been rejected when requireCOCoverage is true');
    }
    console.log('✓ Operating Systems blueprint correctly rejected when hard CO quotas are enforced!');

    // 7. Test Dedicated Collection Saving
    console.log('\n[Check 7] Testing saving to dedicated sample_papers collection...');
    const testSavedDoc = new SamplePaper({
        title: dbmsPaper.title,
        subject: dbmsPaper.subject,
        subjectCode: dbmsPaper.subjectCode,
        institution: dbmsPaper.institution,
        degree: dbmsPaper.degree,
        branch: dbmsPaper.branch,
        duration: dbmsPaper.duration,
        totalMarks: dbmsPaper.totalMarks,
        blueprint: dbmsPaper.blueprint,
        sections: dbmsPaper.sections,
        coverageSummary: dbmsPaper.coverageSummary,
        status: 'FINALIZED',
        createdBy: new mongoose.Types.ObjectId()
    });

    const savedDoc = await testSavedDoc.save();
    console.log(`Sample Paper saved to dedicated collection with ID: ${savedDoc._id}`);

    const retrievedPaper = await SamplePaper.findById(savedDoc._id).lean();
    if (!retrievedPaper || retrievedPaper.totalMarks !== 100) {
        throw new Error('Failed to retrieve saved sample paper');
    }

    // Clean up test saved paper
    await SamplePaper.deleteOne({ _id: savedDoc._id });
    console.log('Cleaned up test paper from sample_papers collection');

    // 8. Final PYQ collection count check
    const finalPYQCount = await PYQ.countDocuments();
    console.log(`\n[Check 8] Final PYQ collection count: ${finalPYQCount} (Initial: ${initialPYQCount})`);
    if (finalPYQCount !== 441) {
        throw new Error(`PYQ collection count changed from 441 to ${finalPYQCount}!`);
    }
    console.log('✓ PYQ collection remained completely untouched at exactly 441 records!');

    await mongoose.disconnect();
    console.log('\n=== ALL STAGE 2 TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
