import mongoose from 'mongoose';

const samplePaperQuestionSchema = new mongoose.Schema({
    questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PYQ',
        default: null
    },
    questionNumber: {
        type: String,
        trim: true,
        default: '1'
    },
    question: {
        type: String,
        required: true,
        trim: true
    },
    marks: {
        type: Number,
        required: true,
        default: 5
    },
    unit: {
        type: String,
        trim: true,
        default: 'Unit 1'
    },
    topic: {
        type: String,
        trim: true,
        default: 'General'
    },
    difficulty: {
        type: String,
        enum: ['Easy', 'Medium', 'Hard'],
        default: 'Medium'
    },
    courseOutcomes: [{
        type: String,
        trim: true
    }],
    programOutcomes: [{
        type: String,
        trim: true
    }],
    bloomLevel: {
        type: String,
        trim: true,
        default: ''
    },
    origin: {
        type: String,
        enum: ['HISTORICAL_IMPORT', 'SAMPLE_PAPER_GENERATED'],
        default: 'HISTORICAL_IMPORT'
    },
    sourcePdf: {
        type: String,
        trim: true,
        default: ''
    },
    paperId: {
        type: String,
        trim: true,
        default: ''
    }
}, { _id: true });

const samplePaperSectionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        default: 'Section A'
    },
    instructions: {
        type: String,
        trim: true,
        default: 'Answer any five full questions choosing one from each unit.'
    },
    sectionMarks: {
        type: Number,
        default: 100
    },
    questions: [samplePaperQuestionSchema]
}, { _id: true });

const samplePaperSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        default: 'Semester End Examination Model Question Paper'
    },
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
    institution: {
        type: String,
        trim: true,
        default: 'Siddaganga Institute of Technology, Tumakuru'
    },
    degree: {
        type: String,
        trim: true,
        default: 'Bachelor of Engineering (B.E.)'
    },
    branch: {
        type: String,
        trim: true,
        default: 'Computer Science and Engineering'
    },
    duration: {
        type: String,
        trim: true,
        default: '3 Hours'
    },
    totalMarks: {
        type: Number,
        required: true,
        default: 100
    },
    blueprint: {
        totalMarks: Number,
        duration: String,
        sourcePolicy: {
            type: String,
            enum: ['HISTORICAL_ONLY', 'HISTORICAL_AND_GENERATED'],
            default: 'HISTORICAL_ONLY'
        },
        requireCOCoverage: {
            type: Boolean,
            default: false
        },
        coDistribution: {
            type: Map,
            of: Number,
            default: {}
        },
        difficultyDistribution: {
            type: Map,
            of: Number,
            default: {}
        },
        sectionConfigs: [{
            name: String,
            instructions: String,
            marksPerQuestion: Number,
            questionsToAnswer: Number,
            totalQuestionsProvided: Number,
            allowedUnits: [String]
        }]
    },
    sections: [samplePaperSectionSchema],
    coverageSummary: {
        coCoverage: {
            type: Map,
            of: new mongoose.Schema({
                requiredMarks: Number,
                actualMarks: Number,
                questionCount: Number
            }, { _id: false }),
            default: {}
        },
        bloomCoverage: {
            type: Map,
            of: Number,
            default: {}
        },
        difficultyCoverage: {
            type: Map,
            of: Number,
            default: {}
        },
        outcomeDataStatus: {
            type: String,
            enum: ['FULL_OBE_VERIFIED', 'NO_OBE_METADATA_IN_SOURCE', 'PARTIAL_OBE_AVAILABLE'],
            default: 'FULL_OBE_VERIFIED'
        }
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
        required: true
    },
    status: {
        type: String,
        enum: ['DRAFT', 'FINALIZED'],
        default: 'FINALIZED'
    }
}, {
    timestamps: true
});

const SamplePaper = mongoose.model('SamplePaper', samplePaperSchema);

export default SamplePaper;
