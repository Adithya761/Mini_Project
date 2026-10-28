/**
 * HTTP End-to-End Test Suite for Sample Paper API
 */

import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'eco_secret_jwt_token_2026_adithya';

const user1Id = '65f000000000000000000001';
const user2Id = '65f000000000000000000002';

const token1 = jwt.sign({ _id: user1Id, email: 'user1@sit.edu', role: 'student' }, JWT_SECRET, { expiresIn: '1h' });
const token2 = jwt.sign({ _id: user2Id, email: 'user2@sit.edu', role: 'student' }, JWT_SECRET, { expiresIn: '1h' });

const API_BASE = 'http://localhost:3000';

let passed = 0;
let failed = 0;

function assert(cond, name, details = '') {
    if (cond) {
        console.log(`  ✓ PASS: ${name}`);
        passed++;
    } else {
        console.error(`  ✗ FAIL: ${name} - ${details}`);
        failed++;
    }
}

async function runHttpTests() {
    console.log('========================================================================');
    console.log('       SAMPLE PAPER GENERATOR HTTP END-TO-END TEST SUITE                ');
    console.log('========================================================================\n');

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/grama_invest');
    const PYQ = mongoose.model('PYQ', new mongoose.Schema({}, { strict: false }), 'pyqs');
    const SamplePaper = mongoose.model('SamplePaper', new mongoose.Schema({}, { strict: false }), 'sample_papers');

    const initialCount = await PYQ.countDocuments();
    assert(initialCount === 441, 'Pre-test historical PYQ count is 441');

    try {
        // 1. GET /pyq/sample-paper/templates
        console.log('\n--- 1. GET /pyq/sample-paper/templates ---');
        const tmplRes = await fetch(`${API_BASE}/pyq/sample-paper/templates`);
        const tmplData = await tmplRes.json();
        assert(tmplRes.status === 200, 'HTTP 200 from /templates');
        assert(Array.isArray(tmplData.templates) && tmplData.templates.length >= 3, 'Returns at least 3 templates');
        const ids = tmplData.templates.map(t => t.id);
        assert(ids.includes('STANDARD_100') && ids.includes('MID_SEM_50') && ids.includes('FLEXIBLE_50'), 
            'Contains STANDARD_100, MID_SEM_50, and FLEXIBLE_50');

        // 2. POST /pyq/sample-paper/generate
        console.log('\n--- 2. POST /pyq/sample-paper/generate (DBMS 100M) ---');
        const genRes = await fetch(`${API_BASE}/pyq/sample-paper/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token1}` },
            body: JSON.stringify({
                subject: 'Database Management Systems',
                title: 'University Model Paper - DBMS',
                totalMarks: 100,
                duration: '180 Minutes',
                seed: 42,
                requireCOCoverage: false
            })
        });
        const genData = await genRes.json();
        assert(genRes.status === 200, 'HTTP 200 from /generate');
        assert(genData.samplePaper && genData.samplePaper.totalMarks === 100, 'Generated paper totalMarks is 100');
        assert(genData.samplePaper.sections.length === 5, 'Paper has 5 sections');
        const generatedPaper = genData.samplePaper;

        // 3. POST /pyq/sample-paper/replace-question
        console.log('\n--- 3. POST /pyq/sample-paper/replace-question ---');
        const origQ = generatedPaper.sections[0].questions[0];
        const replRes = await fetch(`${API_BASE}/pyq/sample-paper/replace-question`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token1}` },
            body: JSON.stringify({
                paperData: generatedPaper,
                sectionIndex: 0,
                questionIndex: 0
            })
        });
        const replData = await replRes.json();
        assert(replRes.status === 200, 'HTTP 200 from /replace-question');
        assert(replData.samplePaper !== undefined, 'Returned updated samplePaper');
        const newQ = replData.samplePaper.sections[0].questions[0];
        assert(String(newQ.questionId) !== String(origQ.questionId), 'Question was replaced with alternative');
        assert(newQ.marks === origQ.marks, 'Marks preserved on replaced question');

        // 4. POST /pyq/sample-paper/save
        console.log('\n--- 4. POST /pyq/sample-paper/save ---');
        const saveRes = await fetch(`${API_BASE}/pyq/sample-paper/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token1}` },
            body: JSON.stringify({ samplePaper: replData.samplePaper })
        });
        const saveData = await saveRes.json();
        assert(saveRes.status === 201, 'HTTP 201 from /save');
        assert(saveData.samplePaper && saveData.samplePaper._id, 'Saved paper has _id');
        const savedPaperId = saveData.samplePaper._id;

        // 5. GET /pyq/sample-paper/saved (User 1)
        console.log('\n--- 5. GET /pyq/sample-paper/saved (User 1) ---');
        const listRes = await fetch(`${API_BASE}/pyq/sample-paper/saved`, {
            headers: { 'Authorization': `Bearer ${token1}` }
        });
        const listData = await listRes.json();
        assert(listRes.status === 200, 'HTTP 200 from /saved');
        assert(Array.isArray(listData.samplePapers), 'Returns samplePapers list');
        assert(listData.samplePapers.some(p => String(p._id) === String(savedPaperId)), 'Saved paper present in user 1 list');

        // 6. User Isolation: User 2 cannot see User 1's saved private paper
        console.log('\n--- 6. User Isolation: User 2 Access Forbidden ---');
        const u2ListRes = await fetch(`${API_BASE}/pyq/sample-paper/saved`, {
            headers: { 'Authorization': `Bearer ${token2}` }
        });
        const u2ListData = await u2ListRes.json();
        assert(!u2ListData.samplePapers.some(p => String(p._id) === String(savedPaperId)), 
            'User 2 saved list does NOT contain User 1 paper');

        const u2GetRes = await fetch(`${API_BASE}/pyq/sample-paper/${savedPaperId}`, {
            headers: { 'Authorization': `Bearer ${token2}` }
        });
        assert(u2GetRes.status === 403 || u2GetRes.status === 404, 'User 2 direct retrieval is denied (403/404)', `Got ${u2GetRes.status}`);

        const u2DelRes = await fetch(`${API_BASE}/pyq/sample-paper/${savedPaperId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token2}` }
        });
        assert(u2DelRes.status === 403 || u2DelRes.status === 404, 'User 2 delete is denied (403/404)', `Got ${u2DelRes.status}`);

        // 7. DELETE /pyq/sample-paper/:id (User 1)
        console.log('\n--- 7. DELETE /pyq/sample-paper/:id (User 1 cleans up) ---');
        const delRes = await fetch(`${API_BASE}/pyq/sample-paper/${savedPaperId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token1}` }
        });
        const delData = await delRes.json();
        assert(delRes.status === 200, 'HTTP 200 from DELETE by owner');

        // 8. Final DB Safety Check
        console.log('\n--- 8. Historical pyqs Collection Integrity ---');
        const finalCount = await PYQ.countDocuments();
        assert(finalCount === 441, 'Historical pyqs collection still has exactly 441 records', `Found ${finalCount}`);

    } catch (err) {
        console.error('HTTP test suite exception:', err);
        failed++;
    } finally {
        await mongoose.disconnect();
        console.log('\n========================================================================');
        console.log(`HTTP TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED`);
        console.log('========================================================================');
        if (failed > 0) process.exit(1);
        else process.exit(0);
    }
}

runHttpTests();
