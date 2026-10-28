import PYQ from '../../../models/pyq.model.js';

/**
 * Update an existing PYQ
 */
export const updatePYQ = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const updated = await PYQ.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
        if (!updated) {
            return res.status(404).json({ error: 'Question not found' });
        }

        res.json({ message: 'Question updated successfully', pyq: updated });
    } catch (error) {
        console.error('Error updating PYQ:', error);
        res.status(500).json({ error: error.message || 'Failed to update question' });
    }
};

/**
 * Delete a PYQ
 */
export const deletePYQ = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await PYQ.findByIdAndDelete(id);
        if (!deleted) {
            return res.status(404).json({ error: 'Question not found' });
        }
        res.json({ message: 'Question deleted successfully from bank' });
    } catch (error) {
        console.error('Error deleting PYQ:', error);
        res.status(500).json({ error: error.message || 'Failed to delete question' });
    }
};

/**
 * Toggle bookmark for a PYQ
 */
export const toggleBookmark = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?._id || req.user?.userId;

        const pyq = await PYQ.findById(id);
        if (!pyq) {
            return res.status(404).json({ error: 'Question not found' });
        }

        const isBookmarked = pyq.bookmarks.some(b => b.toString() === userId.toString());

        if (isBookmarked) {
            pyq.bookmarks = pyq.bookmarks.filter(b => b.toString() !== userId.toString());
        } else {
            pyq.bookmarks.push(userId);
        }

        await pyq.save();

        res.json({
            message: isBookmarked ? 'Bookmark removed' : 'Question bookmarked!',
            isBookmarked: !isBookmarked
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Toggle solved / practiced status for a PYQ
 */
export const toggleSolved = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?._id || req.user?.userId;

        const pyq = await PYQ.findById(id);
        if (!pyq) {
            return res.status(404).json({ error: 'Question not found' });
        }

        const isSolved = pyq.solvedBy.some(s => s.toString() === userId.toString());

        if (isSolved) {
            pyq.solvedBy = pyq.solvedBy.filter(s => s.toString() !== userId.toString());
        } else {
            pyq.solvedBy.push(userId);
        }

        await pyq.save();

        res.json({
            message: isSolved ? 'Marked as unpracticed' : 'Marked as practiced!',
            isSolved: !isSolved
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
