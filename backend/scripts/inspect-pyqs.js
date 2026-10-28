import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import mongoose from 'mongoose';
import PYQ from '../models/pyq.model.js';

async function main() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/grama_invest');
    const total = await PYQ.countDocuments();
    const subjects = await PYQ.aggregate([
        { $group: { _id: "$subject", count: { $sum: 1 }, years: { $addToSet: "$year" } } }
    ]);
    console.log('--- PYQ DB STATUS ---');
    console.log('Database URI:', process.env.MONGO_URI || 'mongodb://localhost:27017/grama_invest');
    console.log('Total PYQ count in DB:', total);
    console.log('Subjects summary:', JSON.stringify(subjects, null, 2));
    process.exit(0);
}

main().catch(err => {
    console.error('Inspection error:', err);
    process.exit(1);
});
