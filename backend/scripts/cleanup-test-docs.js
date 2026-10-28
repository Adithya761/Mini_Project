import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function cleanup() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/grama_invest');
    const PYQ = mongoose.model('PYQ', new mongoose.Schema({}, { strict: false }), 'pyqs');
    const result = await PYQ.deleteMany({ origin: 'STUDENT_SUBMITTED' });
    console.log(`Deleted ${result.deletedCount} student submitted test docs.`);
    const count = await PYQ.countDocuments();
    console.log(`Current total docs in DB: ${count}`);
    await mongoose.disconnect();
}

cleanup();
