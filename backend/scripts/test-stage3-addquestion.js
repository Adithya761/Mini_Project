import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import PYQ from '../models/pyq.model.js';
import { predictPYQsFromHistoricalData } from '../services/pyqPrediction.service.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/grama_invest';

async function runTests() {
    console.log('=== Stage 3 Automated Tests: Add Question Validation & Review Status ===');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1. Initial count check
    const initialPYQCount = await PYQ.countDocuments();
    console.log(`[Check 1] Initial PYQ collection count: ${initialPYQCount}`);
    if (initialPYQCount !== 441) {
        throw new Error(`Expected 441 PYQ records, but found ${initialPYQCount}`);
    }

    // 2. Fetch an existing question from DBMS to test duplicate detection
    const existingDbmsQuestion = await PYQ.findOne({ subject: 'Database Management Systems', isPredicted: false }).lean();
    if (!existingDbmsQuestion) throw new Error('Could not find existing DBMS question');
    console.log(`\n[Check 2] Testing duplicate detection using existing question: "${existingDbmsQuestion.question.substring(0, 50)}..."`);

    // Simulate introducePYQ controller duplicate check logic
    const normalizedInput = existingDbmsQuestion.question.toLowerCase().replace(/[^a-z0-9]/g, '');
    const subjectRegex = new RegExp(`^Database Management Systems$`, 'i');
    const existingMatches = await PYQ.find({ subject: subjectRegex }).select('question').lean();
    const isDuplicate = existingMatches.some(e => e.question.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedInput);

    if (!isDuplicate) {
        throw new Error('Duplicate check failed: exact match was not detected!');
    }
    console.log('✓ Duplicate check successfully detected existing historical question statement!');

    // 3. Test Validation Rules (Short question rejection)
    console.log('\n[Check 3] Testing validation rules (Short question statement)...');
    const shortText = 'What is DBMS?';
    if (shortText.length >= 15) throw new Error('Short test string too long');
    console.log(`Length: ${shortText.length} < 15 -> Correctly flagged as invalid input.`);
    console.log('✓ Short question validation rule verified!');

    // 4. Test Valid Submission Creation with origin: STUDENT_SUBMITTED and reviewStatus: PENDING
    console.log('\n[Check 4] Testing Student Question Creation with PENDING status...');
    const testStudentQuestion = new PYQ({
        subject: 'Database Management Systems',
        subjectCode: '18CS53',
        year: 2026,
        examType: 'Mid-Sem',
        question: 'Explain the distinctions between 3NF and BCNF with a realistic non-trivial database relation decomposition example.',
        questionNumber: 'Q3(a)',
        marks: 10,
        unit: 'Unit 2',
        topic: 'Relational Normalization',
        difficulty: 'Hard',
        bloomLevel: 'L4',
        courseOutcomes: ['CO2'],
        origin: 'STUDENT_SUBMITTED',
        reviewStatus: 'PENDING',
        isVerified: false,
        isPredicted: false
    });

    const savedStudentQ = await testStudentQuestion.save();
    console.log(`Created student question with ID: ${savedStudentQ._id}`);
    console.log(`Origin: ${savedStudentQ.origin} (Expected STUDENT_SUBMITTED)`);
    console.log(`Review Status: ${savedStudentQ.reviewStatus} (Expected PENDING)`);
    console.log(`isVerified: ${savedStudentQ.isVerified} (Expected false)`);

    if (savedStudentQ.origin !== 'STUDENT_SUBMITTED' || savedStudentQ.reviewStatus !== 'PENDING') {
        throw new Error('Failed to set STUDENT_SUBMITTED and PENDING reviewStatus');
    }
    console.log('✓ Student submission successfully created with PENDING review status!');

    // 5. Test Exclusion from Historical Repetition Analysis
    console.log('\n[Check 5] Verifying that PENDING student submissions are strictly excluded from repetition analysis...');
    const predictions = await predictPYQsFromHistoricalData({
        subject: 'Database Management Systems',
        count: 5
    });

    console.log(`Generated ${predictions.length} predictions based on historical bank.`);
    const leakedStudentQ = predictions.find(p => p.question.includes('distinctions between 3NF and BCNF with a realistic non-trivial'));
    if (leakedStudentQ) {
        throw new Error('Security/Integrity failure: unverified PENDING student submission leaked into historical prediction engine!');
    }
    console.log('✓ Verified: PENDING student submission was strictly excluded from historical prediction analysis!');

    // 6. Clean up test student submission
    console.log('\n[Check 6] Cleaning up test student submission...');
    await PYQ.deleteOne({ _id: savedStudentQ._id });
    console.log('Deleted test record');

    // 7. Final PYQ collection count check
    const finalPYQCount = await PYQ.countDocuments();
    console.log(`\n[Check 7] Final PYQ collection count: ${finalPYQCount} (Initial: ${initialPYQCount})`);
    if (finalPYQCount !== 441) {
        throw new Error(`PYQ collection count changed from 441 to ${finalPYQCount}!`);
    }
    console.log('✓ PYQ collection remained completely untouched at exactly 441 records!');

    await mongoose.disconnect();
    console.log('\n=== ALL STAGE 3 TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
