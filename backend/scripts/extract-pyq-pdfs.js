/**
 * extract-pyq-pdfs.js
 * 
 * Phase 1: University PYQ PDF Discovery, Extraction, and Audit Script
 * Grama Invest / ECO Collaboration Platform
 *
 * Usage:
 *   node backend/scripts/extract-pyq-pdfs.js [pdf_directory] [--out <output_dir>] [--preview]
 *
 * Defaults:
 *   pdf_directory: C:\Users\lalit\PycharmProjects\SIT_PYQ_Scraper\downloaded_papers
 *   output_dir:    backend/extracted_pyq
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const pdfParse = require('../node_modules/pdf-parse');

// ============================================================================
// 1. CLI ARGUMENTS & CONFIGURATION
// ============================================================================
const args = process.argv.slice(2);
let inputDir = 'C:\\Users\\lalit\\PycharmProjects\\SIT_PYQ_Scraper\\downloaded_papers';
let outputDir = path.resolve(__dirname, '../extracted_pyq');
let isPreview = true; // default preview mode for Phase 1

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--out' && args[i + 1]) {
        outputDir = path.resolve(process.cwd(), args[i + 1]);
        i++;
    } else if (arg === '--preview') {
        isPreview = true;
    } else if (!arg.startsWith('--') && i === 0) {
        inputDir = path.resolve(arg);
    }
}

console.log('======================================================================');
console.log('       PYQ PDF DISCOVERY, EXTRACTION & AUDIT ENGINE (PHASE 1)         ');
console.log('======================================================================');
console.log(`Input Directory : ${inputDir}`);
console.log(`Output Directory: ${outputDir}`);
console.log(`Mode            : ${isPreview ? 'PREVIEW & EXTRACTION' : 'EXTRACTION'}`);
console.log('======================================================================\n');

if (!fs.existsSync(inputDir)) {
    console.error(`ERROR: Target directory does not exist: ${inputDir}`);
    process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

// ============================================================================
// 2. RECURSIVE PDF DISCOVERY
// ============================================================================
function discoverPdfs(dir) {
    let pdfFiles = [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                pdfFiles = pdfFiles.concat(discoverPdfs(fullPath));
            } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
                pdfFiles.push(fullPath);
            }
        }
    } catch (err) {
        console.error(`Error reading directory ${dir}:`, err.message);
    }
    return pdfFiles;
}

// ============================================================================
// 3. CANONICAL SUBJECT RESOLUTION (Preserve DAA != DSA and SPM != SE)
// ============================================================================
function resolveCanonicalSubject(folderSubject, printedSubject, courseCode) {
    const fsClean = (folderSubject || '').toLowerCase().replace(/[\s_-]+/g, ' ').trim();
    const psClean = (printedSubject || '').toLowerCase().replace(/[\s_-]+/g, ' ').trim();
    const code = (courseCode || '').toUpperCase().trim();

    // 1. Explicit SPM / Software Project Management
    if (psClean.includes('project management') || psClean.includes('spm') || fsClean === 'spm') {
        return 'Software Project Management';
    }

    // 2. Explicit DAA / Design and Analysis of Algorithms
    if (psClean.includes('design and analysis of algorithms') || psClean.includes('daa') || fsClean === 'daa') {
        return 'Design and Analysis of Algorithms';
    }

    // 3. Operating Systems
    if (fsClean.includes('operating') || psClean.includes('operating system')) {
        return 'Operating Systems';
    }

    // 4. Database Management Systems
    if (fsClean.includes('dbms') || psClean.includes('database')) {
        return 'Database Management Systems';
    }

    // 5. Computer Networks
    if (fsClean.includes('network') || psClean.includes('network')) {
        return 'Computer Networks';
    }

    // 6. Data Structures & Algorithms
    if (fsClean.includes('dsa') || psClean.includes('data structure')) {
        return 'Data Structures & Algorithms';
    }

    // 7. Software Engineering (pure)
    if (fsClean.includes('software engineering') || psClean.includes('software engineering')) {
        return 'Software Engineering';
    }

    return folderSubject || 'Unknown Subject';
}

// ============================================================================
// 4. HEADER & METADATA EXTRACTION
// ============================================================================
function extractHeaderMetadata(firstPageText, filename, folderSubject, folderYear) {
    const lines = firstPageText.split('\n').map(l => l.trim()).filter(Boolean);

    let courseCode = null;
    let printedSubject = null;
    let printedExam = null;
    let examYear = null;
    let examMonth = null;
    let examType = 'End-Sem';

    // Step 1: Detect Course Code in first 10 lines
    for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i];
        if (/^USN/i.test(line) || /^1\s*S\s*I/i.test(line) || /Siddaganga/i.test(line)) continue;
        
        // Single code (e.g. 5RCS03, N5CCS02, 1RSCS01, 20AD302, MCA34, CS831)
        const singleCode = line.match(/^([A-Z0-9]{3,10}|[0-9][A-Z0-9]{3,9})$/);
        if (singleCode && !courseCode) {
            courseCode = singleCode[1];
            break;
        }
        // Combined code (e.g. 6RCS01_6CCI01 or 6RCS01 / 6CCI01)
        const combinedCode = line.match(/^([A-Z0-9]{4,8})\s*[\/_]\s*([A-Z0-9]{4,8})$/);
        if (combinedCode && !courseCode) {
            courseCode = `${combinedCode[1]}/${combinedCode[2]}`;
            break;
        }
    }

    // Fallback: If code not found in top lines, check filename (e.g. 122284_5RCS03.pdf -> 5RCS03)
    if (!courseCode) {
        const fnCodeMatch = filename.match(/(?:^|\d+_)([A-Z0-9]{4,10})/i);
        if (fnCodeMatch) {
            courseCode = fnCodeMatch[1].toUpperCase();
        }
    }

    // Step 2: Detect Exam line and Exam Year
    for (let i = 0; i < Math.min(15, lines.length); i++) {
        const line = lines[i];
        if (/Examinations?/i.test(line)) {
            printedExam = line;

            // Extract month & year (e.g., Feb. 2021, July - Aug 2021, March – April 2022, Dec 09 – Jan 10)
            const fullYearMatch = line.match(/\b(20\d{2})\b/);
            if (fullYearMatch) {
                examYear = parseInt(fullYearMatch[1]);
            } else {
                const shortYearMatch = line.match(/[-–]\s*Jan\s*(\d{2})\b/i) || line.match(/[-–]\s*(\d{2})\b/);
                if (shortYearMatch) {
                    const yrNum = parseInt(shortYearMatch[1]);
                    examYear = yrNum < 50 ? 2000 + yrNum : 1900 + yrNum;
                }
            }

            // Extract month session
            const monthMatch = line.match(/(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s*[-–]\s*[A-Za-z.]+)?\s*(?:20\d{2}|\d{2})?/i);
            if (monthMatch) {
                examMonth = monthMatch[0].trim();
            }

            // Check if Mid-Sem / Makeup / Supplementary
            if (/Mid[- ]?Sem/i.test(line)) examType = 'Mid-Sem';
            else if (/Supplementary|Makeup/i.test(line)) examType = 'Supplementary';

            // Extract Subject Title (line following Examinations)
            for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
                const candidate = lines[j];
                if (/^\[Common\s+to/i.test(candidate)) continue;
                if (/^Time:\s*/i.test(candidate) || /^Max\.\s*Marks/i.test(candidate) || /^Note\s*:/i.test(candidate)) break;
                if (candidate.length > 3 && !/^\d+$/.test(candidate)) {
                    printedSubject = candidate;
                    break;
                }
            }
            break;
        }
    }

    // Fallback for year from folder if text has no year
    if (!examYear && folderYear && !isNaN(parseInt(folderYear))) {
        examYear = parseInt(folderYear);
    }

    const canonicalSubject = resolveCanonicalSubject(folderSubject, printedSubject, courseCode);

    return {
        courseCode: courseCode || 'UNKNOWN',
        printedSubject: printedSubject || folderSubject || 'UNKNOWN',
        canonicalSubject,
        printedExam: printedExam || 'UNKNOWN',
        examYear: examYear || null,
        examMonth: examMonth || 'UNKNOWN',
        examType
    };
}

// ============================================================================
// 5. QUESTION EXTRACTION ENGINE (Multi-page with CO, PO, BL, PSO)
// ============================================================================
function extractQuestionsFromPages(pages, headerMeta, filename) {
    const questions = [];
    let currentUnit = 'Unit - I';
    let currentMainQ = 1;
    let currentSubQ = '';
    let currentTextLines = [];
    let currentMarks = null;
    let currentBL = null;
    let currentCO = null;
    let currentPO = null;
    let currentPSO = null;
    let currentSourcePage = 1;
    let inQuestion = false;

    const unitRegex = /^(Unit\s*[-–]\s*[IVX0-9]+|UNIT\s*[-–]\s*[IVX0-9]+|Part\s*[-–]?\s*[A-Z0-9]+)/i;
    const combinedQRegex = /^(?:0?([1-9]|10))\s*[\.\)]?\s*([a-h])[\)\.]\s*(.*)/i; // e.g., 01 a) or 1. a)
    const subQRegex = /^([a-h])[\)\.]\s*(.*)/i; // e.g. a) or a.
    const subQAltRegex = /^\(([a-h])\)\s*(.*)/i; // e.g. (a)
    const orChoiceRegex = /\bOR\b\s*(?:0?([1-9]|10))?/i;

    function flushQuestion() {
        if (inQuestion && currentTextLines.length > 0) {
            // Clean question text
            let rawText = currentTextLines.join(' ').replace(/\s+/g, ' ').trim();

            // Strip trailing outcome artifacts or leftover "OR 02"
            rawText = rawText.replace(/\s+OR\s+(?:0?[1-9]|10)?$/i, '').trim();

            const qNum = currentSubQ 
                ? `Q${currentMainQ}(${currentSubQ})` 
                : `Q${currentMainQ}`;

            const cos = currentCO ? (Array.isArray(currentCO) ? currentCO : [currentCO]) : [];
            const pos = currentPO ? (Array.isArray(currentPO) ? currentPO : [currentPO]) : [];
            const psos = currentPSO ? (Array.isArray(currentPSO) ? currentPSO : [currentPSO]) : [];

            const needsReview = !currentMarks || rawText.length < 15 || cos.length === 0;
            let reviewReason = null;
            if (!currentMarks && cos.length === 0) reviewReason = 'Missing marks and CO/PO';
            else if (!currentMarks) reviewReason = 'Missing marks';
            else if (cos.length === 0) reviewReason = 'Missing CO/PO (likely older syllabus format)';
            else if (rawText.length < 15) reviewReason = 'Question text unusually short';

            questions.push({
                questionId: `${path.parse(filename).name}_${qNum.replace(/[\(\)]/g, '_')}`,
                fileName: filename,
                courseCode: headerMeta.courseCode,
                canonicalSubject: headerMeta.canonicalSubject,
                printedSubject: headerMeta.printedSubject,
                examYear: headerMeta.examYear,
                examMonth: headerMeta.examMonth,
                examType: headerMeta.examType,
                unit: currentUnit,
                questionNumber: qNum,
                mainQuestion: currentMainQ,
                subQuestion: currentSubQ || null,
                questionText: rawText,
                marks: currentMarks,
                bloomLevel: currentBL ? (currentBL.startsWith('L') ? currentBL : `L${currentBL}`) : null,
                courseOutcomes: cos,
                programOutcomes: pos,
                programSpecificOutcomes: psos,
                sourcePage: currentSourcePage,
                needsReview,
                reviewReason
            });
        }

        currentTextLines = [];
        currentMarks = null;
        currentBL = null;
        currentCO = null;
        currentPO = null;
        currentPSO = null;
    }

    for (const page of pages) {
        const lines = page.text.split('\n').map(l => l.trim()).filter(Boolean);
        let skipHeader = (page.pageNum === 1);

        let i = 0;
        while (i < lines.length) {
            const line = lines[i];

            // On page 1, skip everything until instructions / Unit header
            if (skipHeader) {
                if (unitRegex.test(line) || /Note\s*:/i.test(line) || /Time:/i.test(line)) {
                    skipHeader = false;
                }
                i++;
                continue;
            }

            // Page Header / Footer noise skip
            if (/^(Page\s*\d+|Siddaganga Institute|Examinations|Time:|USN\s*1SI)/i.test(line)) {
                i++;
                continue;
            }

            // Unit change
            if (unitRegex.test(line)) {
                flushQuestion();
                inQuestion = false;
                currentUnit = line;
                i++;
                continue;
            }

            // OR choice separator between questions (e.g. "OR" or "OR 02")
            if (/^OR\s*(?:0?([1-9]|10))?$/i.test(line)) {
                const orMatch = line.match(/^OR\s*(?:0?([1-9]|10))?$/i);
                flushQuestion();
                if (orMatch && orMatch[1]) {
                    currentMainQ = parseInt(orMatch[1]);
                } else {
                    currentMainQ += 1;
                }
                inQuestion = false;
                i++;
                continue;
            }

            // Table header row skip (e.g., M BL CO PO PSO)
            if (/^(M\s*BL\s*CO\s*PO|MBLCOPOPSO|M\s*BL\s*CO)/i.test(line)) {
                i++;
                continue;
            }

            // Vertical Metadata Blocks
            // BL
            if (/^BL\s*:\s*([0-9]+)/i.test(line)) {
                currentBL = line.match(/^BL\s*:\s*([0-9]+)/i)[1];
                i++; continue;
            }
            if (/^BL\s*:\s*$/i.test(line) && i + 1 < lines.length && /^[0-9]+$/.test(lines[i+1])) {
                currentBL = lines[++i];
                i++; continue;
            }

            // CO
            if (/^CO\s*:\s*([0-9,]+)/i.test(line)) {
                const raw = line.match(/^CO\s*:\s*([0-9,]+)/i)[1];
                currentCO = raw.split(',').map(n => `CO${n.trim()}`).filter(Boolean);
                i++; continue;
            }
            if (/^CO\s*:\s*$/i.test(line) && i + 1 < lines.length && /^[0-9,]+$/.test(lines[i+1])) {
                const raw = lines[++i];
                currentCO = raw.split(',').map(n => `CO${n.trim()}`).filter(Boolean);
                i++; continue;
            }

            // PO
            if (/^PO\s*:\s*([0-9,]+)/i.test(line)) {
                const raw = line.match(/^PO\s*:\s*([0-9,]+)/i)[1];
                currentPO = raw.split(',').map(n => `PO${n.trim()}`).filter(Boolean);
                i++; continue;
            }
            if (/^PO\s*:\s*$/i.test(line) && i + 1 < lines.length && /^[0-9,]+$/.test(lines[i+1])) {
                const raw = lines[++i];
                currentPO = raw.split(',').map(n => `PO${n.trim()}`).filter(Boolean);
                i++; continue;
            }

            // PSO
            if (/^PSO\s*:\s*([0-9,]+)/i.test(line)) {
                const raw = line.match(/^PSO\s*:\s*([0-9,]+)/i)[1];
                currentPSO = raw.split(',').map(n => `PSO${n.trim()}`).filter(Boolean);
                i++; continue;
            }
            if (/^PSO\s*:\s*$/i.test(line) && i + 1 < lines.length && /^[0-9,]+$/.test(lines[i+1])) {
                const raw = lines[++i];
                currentPSO = raw.split(',').map(n => `PSO${n.trim()}`).filter(Boolean);
                i++; continue;
            }

            // Tabular outcome row (e.g., "6" on line, then "2 1 1 1" or "2 1 2,3" -> Marks=6, BL=2, CO=1, PO=2,3)
            const tabRowMatch = line.match(/^([1-4])\s+([1-6])\s+([0-9,]+)(?:\s+([0-9,]+))?$/);
            if (inQuestion && tabRowMatch) {
                currentBL = tabRowMatch[1];
                currentCO = [`CO${tabRowMatch[2]}`];
                currentPO = tabRowMatch[3].split(',').map(n => `PO${n.trim()}`);
                if (tabRowMatch[4]) currentPSO = tabRowMatch[4].split(',').map(n => `PSO${n.trim()}`);
                i++; continue;
            }

            // Standalone Question Number like "01" or "02"
            if (/^(?:0?[1-9]|10)$/.test(line) && (!inQuestion || currentTextLines.length === 0)) {
                flushQuestion();
                currentMainQ = parseInt(line);
                inQuestion = true;
                currentSourcePage = page.pageNum;
                i++; continue;
            }

            // Standalone Marks Number (e.g. line with just "6" or "05" or "10" or "08")
            if (inQuestion && /^(?:0?[1-9]|1[0-9]|20)$/.test(line)) {
                if (!currentMarks) {
                    currentMarks = parseInt(line);
                    i++; continue;
                }
            }

            // Combined Question: "1 a) Explain..." or "01 a) What is..."
            const combMatch = line.match(combinedQRegex);
            if (combMatch) {
                flushQuestion();
                currentMainQ = parseInt(combMatch[1]);
                currentSubQ = combMatch[2].toLowerCase();
                inQuestion = true;
                currentSourcePage = page.pageNum;
                if (combMatch[3].trim()) {
                    currentTextLines.push(combMatch[3].trim());
                }
                i++; continue;
            }

            // Sub-question Start: "a) Explain..." or "(a) Explain..."
            const subMatch = line.match(subQRegex) || line.match(subQAltRegex);
            if (subMatch && (inQuestion || currentMainQ)) {
                flushQuestion();
                currentSubQ = subMatch[1].toLowerCase();
                inQuestion = true;
                currentSourcePage = page.pageNum;
                if (subMatch[2].trim()) {
                    currentTextLines.push(subMatch[2].trim());
                }
                i++; continue;
            }

            // Question text ending with marks: e.g. "Explain Banker's algorithm. 10"
            if (inQuestion && !currentMarks) {
                const endMarksMatch = line.match(/(.*?)\s+([1-9]|1[0-9]|20)$/);
                if (endMarksMatch && endMarksMatch[1].length > 15) {
                    currentTextLines.push(endMarksMatch[1].trim());
                    currentMarks = parseInt(endMarksMatch[2]);
                    i++; continue;
                }
            }

            // Regular question body line
            if (inQuestion) {
                currentTextLines.push(line);
            }

            i++;
        }
    }

    flushQuestion();
    return questions;
}

// ============================================================================
// 6. CSV HELPER
// ============================================================================
function escapeCsv(val) {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
}

// ============================================================================
// 7. MAIN EXECUTION PIPELINE
// ============================================================================
async function runExtractionPipeline() {
    const pdfFiles = discoverPdfs(inputDir);
    console.log(`Discovered ${pdfFiles.length} total PDF files across folders.\n`);

    const allQuestions = [];
    const auditRows = [];
    const reviewRows = [];

    const stats = {
        totalDiscovered: pdfFiles.length,
        scannedCount: 0,
        textParsedCount: 0,
        totalQuestions: 0,
        questionsWithCOPO: 0,
        questionsWithoutCOPO: 0,
        questionsNeedingReview: 0,
        bySubject: {},
        byYear: {}
    };

    for (let idx = 0; idx < pdfFiles.length; idx++) {
        const filePath = pdfFiles[idx];
        const filename = path.basename(filePath);
        const relPath = path.relative(inputDir, filePath);
        const pathParts = relPath.split(path.sep);
        const folderSubject = pathParts[0];
        const folderYear = pathParts.length > 2 ? pathParts[1] : 'Root';

        process.stdout.write(`[${idx + 1}/${pdfFiles.length}] Processing: ${filename}... `);

        try {
            const buf = fs.readFileSync(filePath);
            const pages = [];

            function render_page(pageData) {
                return pageData.getTextContent().then(function (textContent) {
                    let lastY, text = '';
                    for (let item of textContent.items) {
                        if (lastY == item.transform[5] || !lastY) {
                            text += item.str;
                        } else {
                            text += '\n' + item.str;
                        }
                        lastY = item.transform[5];
                    }
                    pages.push({ pageNum: pageData.pageIndex + 1, text });
                    return text;
                });
            }

            const data = await pdfParse(buf, { pagerender: render_page });
            const totalTextLength = pages.reduce((acc, p) => acc + p.text.trim().length, 0);

            // Check if scanned / empty text
            if (totalTextLength < 60) {
                stats.scannedCount++;
                console.log('⚠️ SCANNED (0 text)');

                auditRows.push({
                    SourceFile: filePath,
                    FileName: filename,
                    FolderSubject: folderSubject,
                    FolderYear: folderYear,
                    CourseCode: 'SCANNED',
                    PrintedSubject: 'SCANNED',
                    CanonicalSubject: folderSubject,
                    ExamYear: folderYear !== 'Unknown_Year' && !isNaN(parseInt(folderYear)) ? folderYear : 'UNKNOWN',
                    ExamMonth: 'UNKNOWN',
                    ExamType: 'UNKNOWN',
                    PageCount: data.numpages || pages.length,
                    QuestionsExtracted: 0,
                    WithCO_PO: 0,
                    Status: 'SCANNED_NEEDS_OCR',
                    ReviewReason: 'Image-only or scanned PDF; text length is 0. Requires OCR or manual entry.'
                });

                reviewRows.push({
                    IssueType: 'SCANNED_PDF',
                    FileName: filename,
                    FolderSubject: folderSubject,
                    FolderYear: folderYear,
                    CourseCode: 'SCANNED',
                    PrintedSubject: 'SCANNED',
                    ExamYear: folderYear,
                    QuestionNumber: 'ALL',
                    SourcePage: 'ALL',
                    Marks: '',
                    CO: '',
                    PO: '',
                    QuestionPreview: 'No digital text layer found',
                    ReviewReason: 'Scanned image PDF - requires OCR extraction'
                });
                continue;
            }

            // Digitally parse text
            stats.textParsedCount++;
            const headerMeta = extractHeaderMetadata(pages[0]?.text || '', filename, folderSubject, folderYear);
            const questions = extractQuestionsFromPages(pages, headerMeta, filename);

            const yearKey = headerMeta.examYear ? headerMeta.examYear.toString() : 'Unknown Year';
            const subjKey = headerMeta.canonicalSubject;

            stats.bySubject[subjKey] = (stats.bySubject[subjKey] || 0) + questions.length;
            stats.byYear[yearKey] = (stats.byYear[yearKey] || 0) + questions.length;

            let fileWithCO = 0;
            for (const q of questions) {
                q.sourcePdf = filePath;
                allQuestions.push(q);
                stats.totalQuestions++;

                if (q.courseOutcomes && q.courseOutcomes.length > 0) {
                    stats.questionsWithCOPO++;
                    fileWithCO++;
                } else {
                    stats.questionsWithoutCOPO++;
                }

                if (q.needsReview) {
                    stats.questionsNeedingReview++;
                    reviewRows.push({
                        IssueType: q.reviewReason || 'NEEDS_REVIEW',
                        FileName: filename,
                        FolderSubject: folderSubject,
                        FolderYear: folderYear,
                        CourseCode: q.courseCode,
                        PrintedSubject: q.printedSubject,
                        ExamYear: q.examYear || 'UNKNOWN',
                        QuestionNumber: q.questionNumber,
                        SourcePage: q.sourcePage,
                        Marks: q.marks || '',
                        CO: q.courseOutcomes?.join(', ') || '',
                        PO: q.programOutcomes?.join(', ') || '',
                        QuestionPreview: q.questionText.substring(0, 80),
                        ReviewReason: q.reviewReason
                    });
                }
            }

            auditRows.push({
                SourceFile: filePath,
                FileName: filename,
                FolderSubject: folderSubject,
                FolderYear: folderYear,
                CourseCode: headerMeta.courseCode,
                PrintedSubject: headerMeta.printedSubject,
                CanonicalSubject: headerMeta.canonicalSubject,
                ExamYear: headerMeta.examYear || 'UNKNOWN',
                ExamMonth: headerMeta.examMonth || 'UNKNOWN',
                ExamType: headerMeta.examType,
                PageCount: pages.length,
                QuestionsExtracted: questions.length,
                WithCO_PO: fileWithCO,
                Status: questions.length > 0 ? 'SUCCESS' : 'NO_QUESTIONS_FOUND',
                ReviewReason: questions.length === 0 ? 'Could not segment question structure' : ''
            });

            console.log(`✓ ${questions.length} Qs (CO/PO: ${fileWithCO})`);

        } catch (err) {
            console.log(`❌ ERROR: ${err.message}`);
            auditRows.push({
                SourceFile: filePath,
                FileName: filename,
                FolderSubject: folderSubject,
                FolderYear: folderYear,
                CourseCode: 'ERROR',
                PrintedSubject: 'ERROR',
                CanonicalSubject: folderSubject,
                ExamYear: 'ERROR',
                ExamMonth: 'ERROR',
                ExamType: 'ERROR',
                PageCount: 0,
                QuestionsExtracted: 0,
                WithCO_PO: 0,
                Status: 'CORRUPTED_OR_READ_ERROR',
                ReviewReason: err.message
            });
        }
    }

    // ========================================================================
    // 8. WRITE ARTIFACTS
    // ========================================================================
    console.log('\nWriting extracted artifacts...');

    // 1. pyq_questions.json
    const questionsFile = path.join(outputDir, 'pyq_questions.json');
    fs.writeFileSync(questionsFile, JSON.stringify(allQuestions, null, 2), 'utf8');
    console.log(`✓ Saved ${allQuestions.length} structured questions to: ${questionsFile}`);

    // 2. pyq_audit.csv
    const auditFile = path.join(outputDir, 'pyq_audit.csv');
    const auditHeaders = [
        'SourceFile', 'FileName', 'FolderSubject', 'FolderYear', 'CourseCode', 
        'PrintedSubject', 'CanonicalSubject', 'ExamYear', 'ExamMonth', 'ExamType', 
        'PageCount', 'QuestionsExtracted', 'WithCO_PO', 'Status', 'ReviewReason'
    ];
    const auditCsvLines = [
        auditHeaders.join(','),
        ...auditRows.map(r => auditHeaders.map(h => escapeCsv(r[h])).join(','))
    ];
    fs.writeFileSync(auditFile, auditCsvLines.join('\n'), 'utf8');
    console.log(`✓ Saved paper audit table (${auditRows.length} rows) to: ${auditFile}`);

    // 3. pyq_review.csv
    const reviewFile = path.join(outputDir, 'pyq_review.csv');
    const reviewHeaders = [
        'IssueType', 'FileName', 'FolderSubject', 'FolderYear', 'CourseCode', 
        'PrintedSubject', 'ExamYear', 'QuestionNumber', 'SourcePage', 'Marks', 
        'CO', 'PO', 'QuestionPreview', 'ReviewReason'
    ];
    const reviewCsvLines = [
        reviewHeaders.join(','),
        ...reviewRows.map(r => reviewHeaders.map(h => escapeCsv(r[h])).join(','))
    ];
    fs.writeFileSync(reviewFile, reviewCsvLines.join('\n'), 'utf8');
    console.log(`✓ Saved review triage table (${reviewRows.length} rows) to: ${reviewFile}`);

    // 4. extraction_summary.json
    const summaryFile = path.join(outputDir, 'extraction_summary.json');
    const summaryData = {
        generatedAt: new Date().toISOString(),
        inputDirectory: inputDir,
        outputDirectory: outputDir,
        statistics: stats,
        scannedFiles: auditRows.filter(r => r.Status === 'SCANNED_NEEDS_OCR').map(r => ({
            fileName: r.FileName,
            subject: r.FolderSubject,
            year: r.FolderYear,
            path: r.SourceFile
        }))
    };
    fs.writeFileSync(summaryFile, JSON.stringify(summaryData, null, 2), 'utf8');
    console.log(`✓ Saved executive summary metrics to: ${summaryFile}`);

    // ========================================================================
    // 9. PRINT SUMMARY CONSOLE TABLE
    // ========================================================================
    console.log('\n======================================================================');
    console.log('                    EXTRACTION SUMMARY REPORT                         ');
    console.log('======================================================================');
    console.log(`Total PDFs Discovered            : ${stats.totalDiscovered}`);
    console.log(`Digitally Extracted PDFs         : ${stats.textParsedCount}`);
    console.log(`Scanned PDFs (Needs OCR/Manual)  : ${stats.scannedCount}`);
    console.log(`Total Questions Extracted        : ${stats.totalQuestions}`);
    console.log(`Questions with Valid CO/PO       : ${stats.questionsWithCOPO}`);
    console.log(`Questions without CO/PO (Older)  : ${stats.questionsWithoutCOPO}`);
    console.log(`Records Flagged for Review       : ${reviewRows.length}`);
    console.log('----------------------------------------------------------------------');
    console.log('Breakdown by Canonical Subject:');
    Object.entries(stats.bySubject).forEach(([subj, count]) => {
        console.log(`  - ${subj.padEnd(42)}: ${count} questions`);
    });
    console.log('----------------------------------------------------------------------');
    console.log('Breakdown by Year:');
    Object.entries(stats.byYear).sort(([a], [b]) => b.localeCompare(a)).forEach(([yr, count]) => {
        console.log(`  - ${yr.padEnd(20)}: ${count} questions`);
    });
    console.log('======================================================================\n');
}

runExtractionPipeline().catch(err => {
    console.error('Fatal Pipeline Failure:', err);
    process.exit(1);
});
