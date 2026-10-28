import PYQ from '../../../models/pyq.model.js';

/**
 * Get distinct subject list, statistics, and year distribution
 */
export const getSubjects = async (req, res) => {
    try {
        const subjects = await PYQ.aggregate([
            {
                $group: {
                    _id: "$subject",
                    count: { $sum: 1 },
                    years: { $addToSet: "$year" },
                    predictedCount: {
                        $sum: { $cond: ["$isPredicted", 1, 0] }
                    },
                    historicalCount: {
                        $sum: { $cond: ["$isPredicted", 0, 1] }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    name: "$_id",
                    count: 1,
                    years: 1,
                    predictedCount: 1,
                    historicalCount: 1
                }
            },
            { $sort: { count: -1 } }
        ]);

        const allYears = await PYQ.distinct("year");
        const totalQuestions = await PYQ.countDocuments();
        const totalPredicted = await PYQ.countDocuments({ isPredicted: true });
        const totalIntroduced = await PYQ.countDocuments({ isPredicted: false });

        res.json({
            stats: {
                totalQuestions,
                totalSubjects: subjects.length,
                totalPredicted,
                totalIntroduced
            },
            subjects,
            years: allYears.sort((a, b) => b - a)
        });
    } catch (error) {
        console.error('Error fetching subjects and stats:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch subjects' });
    }
};
