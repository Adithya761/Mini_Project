import PYQ from '../../../models/pyq.model.js';

/**
 * Get all PYQs with comprehensive filtering (Subject-Wise, Year-Wise, etc.)
 */
export const getPYQs = async (req, res) => {
    try {
        const {
            subject,
            year,
            examType,
            difficulty,
            isPredicted,
            search,
            bookmarkedOnly,
            solvedOnly,
            introducedOnly,
            limit = 100,
            skip = 0
        } = req.query;

        const currentUserId = req.user?._id || req.user?.userId;
        const query = {};

        if (subject && subject !== 'All') {
            query.subject = new RegExp(`^${subject.trim()}$`, 'i');
        }

        if (year && year !== 'All') {
            query.year = parseInt(year);
        }

        if (examType && examType !== 'All') {
            query.examType = examType;
        }

        if (difficulty && difficulty !== 'All') {
            query.difficulty = difficulty;
        }

        if (isPredicted !== undefined && isPredicted !== '' && isPredicted !== 'All') {
            query.isPredicted = isPredicted === 'true';
        }

        if (introducedOnly === 'true' && currentUserId) {
            query.addedBy = currentUserId;
        }

        if (bookmarkedOnly === 'true' && currentUserId) {
            query.bookmarks = currentUserId;
        }

        if (solvedOnly === 'true' && currentUserId) {
            query.solvedBy = currentUserId;
        }

        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim(), 'i');
            query.$or = [
                { question: searchRegex },
                { topic: searchRegex },
                { subject: searchRegex },
                { solution: searchRegex },
                { tags: searchRegex }
            ];
        }

        const totalCount = await PYQ.countDocuments(query);
        const pyqs = await PYQ.find(query)
            .sort({ isPredicted: -1, year: -1, createdAt: -1 })
            .skip(parseInt(skip) || 0)
            .limit(parseInt(limit) || 100)
            .lean();

        // Enrich with user-specific state
        const enriched = pyqs.map(item => ({
            ...item,
            isBookmarked: Boolean(currentUserId && item.bookmarks?.some(id => id.toString() === currentUserId.toString())),
            isSolved: Boolean(currentUserId && item.solvedBy?.some(id => id.toString() === currentUserId.toString())),
            isIntroducedByMe: Boolean(currentUserId && item.addedBy?.toString() === currentUserId.toString())
        }));

        res.json({
            count: enriched.length,
            total: totalCount,
            pyqs: enriched
        });
    } catch (error) {
        console.error('Error fetching PYQs:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch PYQs' });
    }
};

/**
 * Get a single PYQ by ID
 */
export const getPYQById = async (req, res) => {
    try {
        const pyq = await PYQ.findById(req.params.id);
        if (!pyq) {
            return res.status(404).json({ error: 'PYQ not found' });
        }
        res.json(pyq);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
