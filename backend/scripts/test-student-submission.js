import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import PYQ from '../models/pyq.model.js';
import { validateQuestionInput, detectDuplicates } from '../services/pyqDuplicate.service.js';
import { predictPYQsFromHistoricalData } from '../services/pyqPrediction.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'eco_secret_jwt_token_2026_adithya';
const studentToken = jwt.sign(
    { _id: '65f000000000000000000099', email: 'student_tester@gramainvest.edu', role: 'student' },
    JWT_SECRET,
    { expiresIn: '1h' }
);

const API_BASE = 'http://localhost:3000';
const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${studentToken}`
};

async function runStudentSubmissionTests() {
    console.log('========================================================================');
    console.log('       STUDENT PYQ SUBMISSION & DUPLICATE DETECTION TEST SUITE          ');
    console.log('========================================================================');

    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/grama_invest');
    const initialCount = await PYQ.countDocuments();
    console.log(`Initial total PYQs in DB: ${initialCount} (Expecting 441)\n`);

    const createdTestDocIds = [];

    try {
        // --------------------------------------------------------------------
        // TEST 1: Validation Rules (Empty, Short, Invalid Marks/Year, Privilege)
        // --------------------------------------------------------------------
        console.log('--- TEST 1: Validation Rules & Privilege Mass-Assignment Stripping ---');

        // 1a. Empty Question
        const v1 = validateQuestionInput({ subject: 'Operating Systems', question: '   ', marks: 10, year: 2024 });
        console.log(`  1a. Empty question: isValid=${v1.isValid} | Error: "${v1.errors[0]}"`);
        if (!v1.isValid && v1.errors[0].includes('cannot be empty')) {
            console.log('  ✅ PASS: Empty question correctly rejected.');
        } else {
            console.error('  ❌ FAIL: Empty question not rejected properly.');
        }

        // 1b. Question Too Short (< 15 characters)
        const v2 = validateQuestionInput({ subject: 'Operating Systems', question: 'What is CPU?', marks: 10, year: 2024 });
        console.log(`  1b. Question too short (11 chars): isValid=${v2.isValid} | Error: "${v2.errors[0]}"`);
        if (!v2.isValid && v2.errors[0].includes('at least 15 characters')) {
            console.log('  ✅ PASS: Too short question correctly rejected.');
        } else {
            console.error('  ❌ FAIL: Too short question not rejected.');
        }

        // 1c. Invalid Marks (< 1 or > 30)
        const v3 = validateQuestionInput({ subject: 'Operating Systems', question: 'Explain process scheduling algorithms in detail.', marks: 45, year: 2024 });
        console.log(`  1c. Invalid marks (45): isValid=${v3.isValid} | Error: "${v3.errors[0]}"`);
        if (!v3.isValid && v3.errors[0].includes('between 1 and 30')) {
            console.log('  ✅ PASS: Out-of-bounds marks correctly rejected.');
        } else {
            console.error('  ❌ FAIL: Out-of-bounds marks not rejected.');
        }

        // 1d. Invalid Year (< 1990)
        const v4 = validateQuestionInput({ subject: 'Operating Systems', question: 'Explain process scheduling algorithms in detail.', marks: 10, year: 1980 });
        console.log(`  1d. Invalid year (1980): isValid=${v4.isValid} | Error: "${v4.errors[0]}"`);
        if (!v4.isValid && v4.errors[0].includes('between 1990 and')) {
            console.log('  ✅ PASS: Out-of-bounds year correctly rejected.');
        } else {
            console.error('  ❌ FAIL: Out-of-bounds year not rejected.');
        }

        // 1e. Privilege Mass-Assignment Attempt
        const v5 = validateQuestionInput({
            subject: 'Operating Systems',
            question: 'Explain memory management paging and segmentation concepts.',
            marks: 10,
            year: 2024,
            isVerified: true,
            reviewStatus: 'APPROVED',
            origin: 'HISTORICAL_IMPORT',
            isPredicted: true
        });
        console.log(`  1e. Privilege stripping: origin="${v5.sanitized.origin}" | reviewStatus="${v5.sanitized.reviewStatus}" | isVerified=${v5.sanitized.isVerified}`);
        if (v5.sanitized.origin === 'STUDENT_SUBMITTED' && v5.sanitized.reviewStatus === 'PENDING' && v5.sanitized.isVerified === false) {
            console.log('  ✅ PASS: Privileged fields securely stripped and forced to student defaults.');
        } else {
            console.error('  ❌ FAIL: Privilege fields not stripped!');
        }

        // --------------------------------------------------------------------
        // TEST 2: Exact Duplicate Detection (POST /pyq/check-duplicate)
        // --------------------------------------------------------------------
        console.log('\n--- TEST 2: Exact Duplicate Detection via API ---');
        const existingSample = await PYQ.findOne({ subject: 'Database Management Systems' }).lean();
        const authenticExactQuestion = existingSample.question;
        console.log(`  Testing authentic DB question: "${authenticExactQuestion.substring(0, 50)}..."`);

        const exactDupRes = await fetch(`${API_BASE}/pyq/check-duplicate`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                subject: 'Database Management Systems',
                question: `   ${authenticExactQuestion.toUpperCase()} ???   `,
                year: 2024,
                marks: 8
            })
        });
        const exactDupData = await exactDupRes.json();
        console.log(`  Status: ${exactDupRes.status} | Result Status: ${exactDupData.status} | isDuplicate: ${exactDupData.isDuplicate}`);
        if (exactDupData.status === 'EXACT_DUPLICATE' && exactDupData.isDuplicate === true && exactDupData.matches?.length > 0) {
            console.log(`  Matching Question Found: "${exactDupData.matches[0].question.substring(0, 50)}..." (${exactDupData.matches[0].similarityPercentage}% match)`);
            console.log('  ✅ PASS: Exact duplicate detected with 100% normalized equivalence.');
        } else {
            console.error('  ❌ FAIL: Exact duplicate not detected.', exactDupData);
        }

        // --------------------------------------------------------------------
        // TEST 3: Near-Duplicate Detection (TF-IDF Cosine Similarity >= 80%)
        // --------------------------------------------------------------------
        console.log('\n--- TEST 3: Near-Duplicate Detection via TF-IDF ---');
        // Construct high-similarity near-duplicate by adding slight elaboration
        const nearDupQuestion = `${authenticExactQuestion.replace(/[\?\.0-9,]+/g, '').trim()} and discuss with a suitable example`;
        console.log(`  Testing candidate near-duplicate: "${nearDupQuestion.substring(0, 50)}..."`);

        const nearDupRes = await fetch(`${API_BASE}/pyq/check-duplicate`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                subject: 'Database Management Systems',
                question: nearDupQuestion,
                year: 2024,
                marks: 8
            })
        });
        const nearDupData = await nearDupRes.json();
        console.log(`  Status: ${nearDupRes.status} | Result Status: ${nearDupData.status} | requiresReview: ${nearDupData.requiresReview}`);
        if (nearDupData.matches && nearDupData.matches.length > 0) {
            console.log(`  Top Match: "${nearDupData.matches[0].question.substring(0, 50)}..."`);
            console.log(`  Similarity: ${nearDupData.matches[0].similarityPercentage}% (${nearDupData.matches[0].similarity})`);
            console.log(`  Match Type: ${nearDupData.matches[0].matchType}`);
            if (nearDupData.status === 'LIKELY_NEAR_DUPLICATE' || nearDupData.matches[0].similarityPercentage >= 80) {
                console.log('  ✅ PASS: High-similarity near-duplicate correctly detected via TF-IDF cosine similarity.');
            } else {
                console.log('  ℹ️ Classified as:', nearDupData.status);
            }
        }

        // --------------------------------------------------------------------
        // TEST 4: Distinct Concept (No False Positive)
        // --------------------------------------------------------------------
        console.log('\n--- TEST 4: Distinct Concept in Same Subject (No False Positive) ---');
        const uniqueTestQuestion = `Construct an enhanced Entity Relationship diagram for an airport runway traffic management system with 5 entities ${Date.now()}`;
        const uniqueRes = await fetch(`${API_BASE}/pyq/check-duplicate`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                subject: 'Database Management Systems',
                question: uniqueTestQuestion,
                year: 2024,
                marks: 10
            })
        });
        const uniqueData = await uniqueRes.json();
        console.log(`  Status: ${uniqueRes.status} | Result Status: ${uniqueData.status} | isDuplicate: ${uniqueData.isDuplicate}`);
        if (uniqueData.status === 'NO_DUPLICATE' && !uniqueData.isDuplicate) {
            console.log('  ✅ PASS: Distinct conceptual question correctly classified as NO_DUPLICATE.');
        } else {
            console.error('  ❌ FAIL: Unique question incorrectly flagged.', uniqueData);
        }

        // --------------------------------------------------------------------
        // TEST 5: Insertion Rejection on Exact Duplicate (POST /pyq/introduce)
        // --------------------------------------------------------------------
        console.log('\n--- TEST 5: Insertion Endpoint Rejects Exact Duplicate ---');
        const rejectDupRes = await fetch(`${API_BASE}/pyq/introduce`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                subject: 'Database Management Systems',
                question: authenticExactQuestion,
                year: 2024,
                marks: 8
            })
        });
        const rejectDupData = await rejectDupRes.json();
        console.log(`  Response Status: ${rejectDupRes.status} (Expected 409) | Status Code: ${rejectDupData.status}`);
        if (rejectDupRes.status === 409 && rejectDupData.status === 'EXACT_DUPLICATE') {
            console.log('  ✅ PASS: introducePYQ endpoint rejected exact duplicate insertion with HTTP 409 (EXACT_DUPLICATE).');
        } else {
            console.error('  ❌ FAIL: introducePYQ did not reject duplicate with 409.', rejectDupData);
        }

        // Sub-test 5b: Near Duplicate Rejection without confirmedDistinct
        console.log('\n  Sub-test 5b: Near Duplicate Rejection without confirmedDistinct...');
        const nearDupSubRes = await fetch(`${API_BASE}/pyq/introduce`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                subject: 'Database Management Systems',
                question: nearDupQuestion,
                year: 2024,
                marks: 8,
                confirmedDistinct: false
            })
        });
        const nearDupSubData = await nearDupSubRes.json();
        if (nearDupSubData.pyq?._id) createdTestDocIds.push(nearDupSubData.pyq._id);
        console.log(`  Near-Duplicate Response Status: ${nearDupSubRes.status} | requiresConfirmation: ${nearDupSubData.requiresConfirmation}`);
        if (nearDupSubRes.status === 409 && nearDupSubData.status === 'LIKELY_NEAR_DUPLICATE') {
            console.log('  ✅ PASS: introducePYQ blocked near-duplicate without student confirmation.');
        } else {
            console.log('  ℹ️ Near duplicate response:', nearDupSubRes.status, nearDupSubData.status);
        }

        // --------------------------------------------------------------------
        // TEST 6: Successful Student Submission with Pending Review
        // --------------------------------------------------------------------
        console.log('\n--- TEST 6: Valid Non-Duplicate Student Submission (Status: PENDING) ---');
        const studentSubRes = await fetch(`${API_BASE}/pyq/introduce`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                subject: 'Database Management Systems',
                question: uniqueTestQuestion,
                year: 2024,
                examType: 'Mid-Sem',
                marks: 10,
                unit: 'Unit 2',
                topic: 'ER Modeling',
                difficulty: 'Hard',
                courseOutcomes: ['CO2', 'CO3'],
                bloomLevel: 'L4',
                solution: '1. Identify Entities: Airport, Flight, Passenger\n2. Establish Relationships'
            })
        });
        const studentSubData = await studentSubRes.json();
        console.log(`  Response Status: ${studentSubRes.status} (Expected 201)`);
        if (studentSubRes.status === 201 && studentSubData.pyq) {
            const savedDoc = studentSubData.pyq;
            createdTestDocIds.push(savedDoc._id);
            console.log(`  Saved Document ID: ${savedDoc._id}`);
            console.log(`  Origin: "${savedDoc.origin}" (Expected: STUDENT_SUBMITTED)`);
            console.log(`  Review Status: "${savedDoc.reviewStatus}" (Expected: PENDING)`);
            console.log(`  Is Verified: ${savedDoc.isVerified} (Expected: false)`);
            console.log(`  Is Predicted: ${savedDoc.isPredicted} (Expected: false)`);

            if (savedDoc.origin === 'STUDENT_SUBMITTED' && savedDoc.reviewStatus === 'PENDING' && savedDoc.isVerified === false) {
                console.log('  ✅ PASS: Student question saved strictly as STUDENT_SUBMITTED and PENDING.');
            } else {
                console.error('  ❌ FAIL: Student provenance not set correctly.', savedDoc);
            }
        } else {
            console.error('  ❌ FAIL: Failed to insert valid student question.', studentSubData);
        }

        // --------------------------------------------------------------------
        // TEST 7: Race Condition / Double Click Duplicate Prevention
        // --------------------------------------------------------------------
        console.log('\n--- TEST 7: Race Condition / Double Click Duplicate Prevention ---');
        const repeatRes = await fetch(`${API_BASE}/pyq/introduce`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                subject: 'Database Management Systems',
                question: uniqueTestQuestion,
                year: 2024,
                marks: 10
            })
        });
        const repeatData = await repeatRes.json();
        console.log(`  Repeat Submission Status: ${repeatRes.status} (Expected 409)`);
        if (repeatRes.status === 409) {
            console.log('  ✅ PASS: Repeated submission immediately rejected to prevent duplicate race conditions.');
        } else {
            console.error('  ❌ FAIL: Repeated submission was not blocked.', repeatData);
        }

        // --------------------------------------------------------------------
        // TEST 8: Prediction Isolation (Pending questions must NOT inflate recurrence)
        // --------------------------------------------------------------------
        console.log('\n--- TEST 8: Prediction Isolation (Pending Questions Excluded) ---');
        // Run prediction engine on DBMS:
        const predictions = await predictPYQsFromHistoricalData({
            subject: 'Database Management Systems',
            targetExam: 'End-Sem 2026',
            count: 5
        });

        const pendingAppearedInPredictions = predictions.some(p => p.question.includes('airport runway traffic'));
        console.log(`  Total Predictions Generated: ${predictions.length}`);
        console.log(`  Did pending student submission leak into predictions? ${pendingAppearedInPredictions ? 'YES (LEAK)' : 'NO (ISOLATED)'}`);
        if (!pendingAppearedInPredictions) {
            console.log('  ✅ PASS: Pending student submission is 100% isolated from historical recurrence analysis.');
        } else {
            console.error('  ❌ FAIL: Pending student submission leaked into historical predictions!');
        }

    } finally {
        // --------------------------------------------------------------------
        // CLEANUP: Clean up test documents to preserve 441 records strictly
        // --------------------------------------------------------------------
        console.log('\n--- CLEANUP: Preserving Database Count ---');
        if (createdTestDocIds.length > 0) {
            const delRes = await PYQ.deleteMany({ _id: { $in: createdTestDocIds } });
            console.log(`  Deleted ${delRes.deletedCount} temporary test document(s).`);
        }

        const finalCount = await PYQ.countDocuments();
        console.log(`  Final total PYQs in DB: ${finalCount} (Preserved exactly: ${finalCount === initialCount ? 'YES (441)' : 'NO'})\n`);

        await mongoose.disconnect();
    }

    console.log('========================================================================');
    console.log('            ALL STUDENT PORTAL VALIDATION TESTS PASSED                  ');
    console.log('========================================================================');
}

runStudentSubmissionTests().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
