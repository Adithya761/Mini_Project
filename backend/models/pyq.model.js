import mongoose from 'mongoose';

const pyqSchema = new mongoose.Schema({
    // Core Subject & Paper Metadata
    subject: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    subjectCode: {
        type: String,
        trim: true,
        default: ''
    },
    year: {
        type: Number,
        required: true,
        index: true
    },
    examType: {
        type: String,
        default: 'End-Sem',
        trim: true
    },
    semester: {
        type: String,
        trim: true,
        default: ''
    },
    institution: {
        type: String,
        trim: true,
        default: ''
    },
    branch: {
        type: String,
        trim: true,
        default: ''
    },
    regulation: {
        type: String,
        trim: true,
        default: ''
    },

    // Question Identification & Hierarchy
    questionNumber: {
        type: String,
        trim: true,
        default: ''
    },
    mainQuestion: {
        type: Number,
        default: null
    },
    subQuestion: {
        type: String,
        trim: true,
        default: ''
    },
    part: {
        type: String,
        trim: true,
        default: ''
    },

    // Question Content & Categorization
    question: {
        type: String,
        required: true,
        trim: true
    },
    questionType: {
        type: String,
        default: 'Subjective',
        trim: true
    },
    marks: {
        type: Number,
        default: 5
    },
    unit: {
        type: String,
        default: 'Unit 1'
    },
    topic: {
        type: String,
        trim: true,
        default: 'General'
    },
    solution: {
        type: String,
        trim: true,
        default: ''
    },
    difficulty: {
        type: String,
        enum: ['Easy', 'Medium', 'Hard'],
        default: 'Medium'
    },

    // Outcome-Based Education (OBE) Metadata
    bloomLevel: {
        type: String,
        trim: true,
        default: ''
    },
    courseOutcomes: [{
        type: String,
        trim: true
    }],
    programOutcomes: [{
        type: String,
        trim: true
    }],
    programSpecificOutcomes: [{
        type: String,
        trim: true
    }],

    // Provenance & Source PDF Metadata
    sourcePdf: {
        type: String,
        trim: true,
        default: ''
    },
    sourceRelativePath: {
        type: String,
        trim: true,
        default: ''
    },
    sourcePage: {
        type: Number,
        default: 1
    },
    paperId: {
        type: String,
        trim: true,
        index: true,
        default: ''
    },
    paperQuestionKey: {
        type: String,
        trim: true,
        index: true,
        default: ''
    },

    // Verification, Origin & Submission Review Status
    origin: {
        type: String,
        enum: ['HISTORICAL_IMPORT', 'STUDENT_SUBMITTED', 'AI_PREDICTED', 'SAMPLE_PAPER_GENERATED'],
        default: 'HISTORICAL_IMPORT',
        index: true
    },
    reviewStatus: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED'],
        default: 'PENDING',
        index: true
    },
    isVerified: {
        type: Boolean,
        default: false,
        index: true
    },
    isPredicted: {
        type: Boolean,
        default: false,
        index: true
    },
    predictionReasoning: {
        type: String,
        default: ''
    },
    probability: {
        type: Number,
        min: 0,
        max: 100,
        default: 85
    },
    frequency: {
        type: Number,
        default: 1
    },
    historicalRepetitionCount: {
        type: Number,
        default: 1
    },
    appearedYears: [{
        type: Number
    }],
    evidenceLevel: {
        type: String,
        enum: ['HIGH_CONFIDENCE', 'MEDIUM_CONFIDENCE', 'EMERGING_TREND', 'VERIFIED_HISTORICAL', ''],
        default: ''
    },

    // User Engagements & Bookmarks
    bookmarks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    solvedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    tags: [{
        type: String,
        trim: true
    }]
}, {
    timestamps: true
});

// Text index for search
pyqSchema.index({
    question: 'text',
    topic: 'text',
    subject: 'text',
    solution: 'text'
});

// Compound non-unique indexes for fast paper and subject/year queries
pyqSchema.index({ subject: 1, year: 1, examType: 1 });
pyqSchema.index({ paperId: 1, questionNumber: 1 });

const PYQ = mongoose.model('PYQ', pyqSchema);

export default PYQ;
