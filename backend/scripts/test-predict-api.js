import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import PYQ from '../models/pyq.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'eco_secret_jwt_token_2026_adithya';
const testToken = jwt.sign(
    { _id: '65f000000000000000000001', email: 'tester@gramainvest.edu', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '1h' }
);

async function runEndToEndApiTests() {
    console.log('================================================================');
    console.log('   END-TO-END VALIDATION: /pyq/predict & /pyq/save-predicted   ');
    console.log('================================================================');

    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/grama_invest');
    const initialCount = await PYQ.countDocuments();
    console.log(`Initial total PYQs in DB: ${initialCount} (Expecting 441)\n`);

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`
    };

    // Test 1: Operating Systems (Test strict non-fabrication of CO/PO and Bloom)
    console.log('--- TEST 1: Operating Systems (Strict Metadata Non-Fabrication) ---');
    const osRes = await fetch('http://localhost:3000/pyq/predict', {
        method: 'POST',
        headers,
        body: JSON.stringify({
            subject: 'Operating Systems',
            targetExam: 'End-Sem 2026',
            count: 3,
            difficulty: 'Medium'
        })
    });
    const osData = await osRes.json();
    console.log(`Status: ${osRes.status} | Returned ${osData.predictions?.length || 0} predictions`);
    if (osData.predictions && osData.predictions.length > 0) {
        const p = osData.predictions[0];
        console.log(`Top question: "${p.question.substring(0, 60)}..."`);
        console.log(`  Confidence Label: "${p.confidenceLabel}" (${p.evidenceLevel})`);
        console.log(`  Match Type: "${p.matchType}"`);
        console.log(`  Bloom Level: ${p.bloomLevel} (Expected: null)`);
        console.log(`  COs: [${(p.courseOutcomes || []).join(', ')}] (Expected: empty)`);
        console.log(`  Metadata Limitations: "${p.metadataLimitations || 'None'}"`);
        if (p.bloomLevel !== null || (p.courseOutcomes && p.courseOutcomes.length > 0)) {
            console.error('❌ FAIL: Operating Systems fabricated Bloom level or COs!');
        } else {
            console.log('✅ PASS: OS did not fabricate missing CO/PO or Bloom level.');
        }
    }

    // Test 2: Computer Networks (Test Insufficient Data honesty)
    console.log('\n--- TEST 2: Computer Networks (Insufficient Data Honesty) ---');
    const cnRes = await fetch('http://localhost:3000/pyq/predict', {
        method: 'POST',
        headers,
        body: JSON.stringify({
            subject: 'Computer Networks',
            targetExam: 'End-Sem 2026',
            count: 3
        })
    });
    const cnData = await cnRes.json();
    console.log(`Status: ${cnRes.status} | Returned ${cnData.predictions?.length || 0} items`);
    const cnFirst = cnData.predictions?.[0];
    if (cnFirst) {
        console.log(`  Top question: "${cnFirst.question.substring(0, 60)}..."`);
        console.log(`  Evidence Level: ${cnFirst.evidenceLevel} (Expected: INSUFFICIENT_DATA)`);
        console.log(`  Confidence Label: "${cnFirst.confidenceLabel}"`);
        console.log(`  Metadata Limitations: "${cnFirst.metadataLimitations}"`);
        if (cnFirst.evidenceLevel === 'INSUFFICIENT_DATA' && cnFirst.confidenceLabel === 'Insufficient historical data') {
            console.log('✅ PASS: Computer Networks correctly returned honest INSUFFICIENT_DATA.');
        } else {
            console.error('❌ FAIL: Computer Networks did not return INSUFFICIENT_DATA.');
        }
    } else {
        console.log('  No predictions or historical data returned.');
    }

    // Test 3: Database Management Systems (Substantive Prediction & Save Test)
    console.log('\n--- TEST 3: DBMS Prediction and Idempotent Save ---');
    const dbmsRes = await fetch('http://localhost:3000/pyq/predict', {
        method: 'POST',
        headers,
        body: JSON.stringify({
            subject: 'Database Management Systems',
            targetExam: 'End-Sem 2026',
            count: 3,
            difficulty: 'Medium'
        })
    });
    const dbmsData = await dbmsRes.json();
    console.log(`Status: ${dbmsRes.status} | Returned ${dbmsData.predictions?.length || 0} predictions`);
    if (dbmsData.predictions && dbmsData.predictions.length > 0) {
        const sample = dbmsData.predictions[0];
        console.log(`Top question: "${sample.question.substring(0, 60)}..."`);
        console.log(`  Confidence Label: "${sample.confidenceLabel}"`);
        console.log(`  Recurrence (Distinct Papers): ${sample.historicalRepetitionCount} | Years: [${sample.appearedYears.join(', ')}]`);
        console.log(`  Match Type: "${sample.matchType}"`);
        console.log(`  Reasoning: "${sample.predictionReasoning?.substring(0, 80)}..."`);

        // Now test saving this predicted question
        console.log('\n  Sub-test: Saving predicted question to PYQ Bank...');
        const uniqueTestQuestion = `Automated Test Question for Idempotency Verification ${Date.now()}`;
        const testPayload = {
            subject: 'Database Management Systems',
            targetExam: 'End-Sem 2026',
            questions: [{
                ...sample,
                question: uniqueTestQuestion
            }]
        };

        const saveRes1 = await fetch('http://localhost:3000/pyq/save-predicted', {
            method: 'POST',
            headers,
            body: JSON.stringify(testPayload)
        });
        const saveData1 = await saveRes1.json();
        console.log(`  First Save Response: Status ${saveRes1.status} | Count: ${saveData1.count} | Duplicates Skipped: ${saveData1.duplicatesSkipped}`);

        // Try saving the EXACT same question again to verify duplicate prevention
        console.log('  Sub-test: Retrying save of same question (Duplicate Prevention)...');
        const saveRes2 = await fetch('http://localhost:3000/pyq/save-predicted', {
            method: 'POST',
            headers,
            body: JSON.stringify(testPayload)
        });
        const saveData2 = await saveRes2.json();
        console.log(`  Second Save Response: Status ${saveRes2.status} | Count: ${saveData2.count} | Duplicates Skipped: ${saveData2.duplicatesSkipped}`);

        if (saveData1.count === 1 && saveData2.count === 0 && saveData2.duplicatesSkipped === 1) {
            console.log('✅ PASS: Duplicate prevention successfully prevented redundant question insertion.');
        } else {
            console.error('❌ FAIL: Duplicate prevention did not work as expected.');
        }

        // Clean up the test question inserted so 441 records remain strictly preserved!
        const deleteRes = await PYQ.deleteOne({ question: uniqueTestQuestion });
        console.log(`  Cleaned up test insertion: ${deleteRes.deletedCount} doc removed.`);
    }

    const finalCount = await PYQ.countDocuments();
    console.log(`\nFinal total PYQs in DB: ${finalCount} (Preserved exactly: ${finalCount === initialCount ? 'YES' : 'NO'})\n`);

    await mongoose.disconnect();
    console.log('================================================================');
    console.log('                  API VALIDATION COMPLETED                      ');
    console.log('================================================================');
}

runEndToEndApiTests().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
