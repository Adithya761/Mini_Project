import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function inspectMarks() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/grama_invest');
    const PYQ = mongoose.model('PYQ', new mongoose.Schema({}, { strict: false }), 'pyqs');

    for (const sub of ['Database Management Systems', 'Software Engineering', 'Operating Systems', 'Computer Networks']) {
        const marks = await PYQ.aggregate([
            { $match: { subject: sub, isPredicted: false, origin: { $ne: 'STUDENT_SUBMITTED' } } },
            { $group: { _id: '$marks', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        const units = await PYQ.aggregate([
            { $match: { subject: sub, isPredicted: false, origin: { $ne: 'STUDENT_SUBMITTED' } } },
            { $group: { _id: '$unit', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        console.log(`\n=== Subject: ${sub} ===`);
        console.log('Marks Distribution:', marks);
        console.log('Units Distribution:', units.slice(0, 8));
    }

    await mongoose.disconnect();
}

inspectMarks();
