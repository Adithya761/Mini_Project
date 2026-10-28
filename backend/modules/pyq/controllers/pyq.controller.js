import PYQ from '../../../models/pyq.model.js';
import * as ai from '../../../services/ai.services.js';

// Pre-seeded authentic university PYQs across core subjects
const INITIAL_PYQ_DATA = [
    // --- OPERATING SYSTEMS ---
    {
        subject: "Operating Systems",
        subjectCode: "CS401",
        year: 2024,
        examType: "End-Sem",
        question: "Explain Banker's Algorithm for deadlock avoidance. Given the snapshot of a system with 5 processes P0-P4 and 3 resource types A (10), B (5), C (7), determine if the system is in a safe state.",
        questionType: "Numerical",
        marks: 10,
        unit: "Unit 3",
        topic: "Deadlocks & Resource Allocation",
        difficulty: "Hard",
        frequency: 4,
        tags: ["Operating Systems", "Deadlock", "Banker's Algorithm", "Safe State"],
        solution: "Banker's Algorithm is a deadlock avoidance algorithm developed by Edsger Dijkstra.\n\n1. Calculate Need Matrix:\n   Need[i][j] = Max[i][j] - Allocation[i][j].\n\n2. Safety Algorithm Steps:\n   - Let Work = Available, Finish[i] = False for all i.\n   - Find an index i such that Finish[i] == False and Need[i] <= Work.\n   - If such an i exists, Work = Work + Allocation[i], Finish[i] = True. Loop back.\n   - If all Finish[i] == True, the system is in a SAFE STATE with safe sequence <P1, P3, P4, P0, P2>."
    },
    {
        subject: "Operating Systems",
        subjectCode: "CS401",
        year: 2023,
        examType: "End-Sem",
        question: "What is the Critical Section Problem? Discuss the three requirements that any valid solution must satisfy. Explain Peterson's solution for two processes.",
        questionType: "Subjective",
        marks: 10,
        unit: "Unit 2",
        topic: "Process Synchronization",
        difficulty: "Medium",
        frequency: 3,
        tags: ["Operating Systems", "Process Synchronization", "Critical Section", "Peterson Algorithm"],
        solution: "Requirements for Critical Section Solution:\n1. Mutual Exclusion: If process Pi is executing in its critical section, then no other processes can be executing in their critical sections.\n2. Progress: If no process is executing in its critical section and some processes wish to enter, only those processes not in their remainder section can participate in the decision.\n3. Bounded Waiting: A bound must exist on the number of times other processes are allowed to enter their critical sections after a process has made a request.\n\nPeterson's Algorithm uses two shared variables:\nboolean flag[2]; int turn;\nEntry Section:\nflag[i] = true; turn = j;\nwhile (flag[j] && turn == j); // busy wait\n// Critical Section\nflag[i] = false; // Exit Section"
    },
    {
        subject: "Operating Systems",
        subjectCode: "CS401",
        year: 2022,
        examType: "Mid-Sem",
        question: "Compare FIFO, LRU, and Optimal page replacement algorithms with reference string 7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1 with 3 frames. Calculate page faults.",
        questionType: "Numerical",
        marks: 8,
        unit: "Unit 4",
        topic: "Virtual Memory & Page Replacement",
        difficulty: "Medium",
        frequency: 5,
        tags: ["Operating Systems", "Virtual Memory", "Page Replacement", "LRU", "FIFO"],
        solution: "With 3 frames:\n1. FIFO (First In First Out): Replaces the oldest loaded page. Yields ~15 page faults.\n2. LRU (Least Recently Used): Replaces page not used for the longest period. Yields ~12 page faults.\n3. Optimal (Belady's): Replaces page that will not be used for the longest period in future. Yields ~9 page faults (Theoretical lower bound)."
    },

    // --- DATABASE MANAGEMENT SYSTEMS ---
    {
        subject: "Database Management Systems",
        subjectCode: "CS402",
        year: 2024,
        examType: "End-Sem",
        question: "What is Normalization? Explain 1NF, 2NF, 3NF, and BCNF with suitable relational examples and discuss lossless join decomposition.",
        questionType: "Subjective",
        marks: 10,
        unit: "Unit 2",
        topic: "Relational Schema Normalization",
        difficulty: "Medium",
        frequency: 5,
        tags: ["DBMS", "Normalization", "BCNF", "3NF", "Lossless Join"],
        solution: "Normalization minimizes redundancy and eliminates update anomalies.\n\n- 1NF: Atomic domain values, no multivalued or composite attributes.\n- 2NF: In 1NF and no partial dependencies (every non-prime attribute is fully functionally dependent on the entire candidate key).\n- 3NF: In 2NF and no transitive dependencies (for any non-trivial FD X -> A, either X is a superkey or A is a prime attribute).\n- BCNF (Boyce-Codd Normal Form): Strict 3NF where for every non-trivial FD X -> A, X must be a superkey.\n\nLossless Join Property: A decomposition of R into (R1, R2) is lossless if and only if R1 ∩ R2 -> R1 or R1 ∩ R2 -> R2."
    },
    {
        subject: "Database Management Systems",
        subjectCode: "CS402",
        year: 2023,
        examType: "End-Sem",
        question: "Explain the concept of Conflict Serializability and View Serializability. How do you test for conflict serializability using precedence graphs?",
        questionType: "Analytical",
        marks: 10,
        unit: "Unit 4",
        topic: "Transactions & Concurrency Control",
        difficulty: "Hard",
        frequency: 3,
        tags: ["DBMS", "Transactions", "Conflict Serializability", "Precedence Graph"],
        solution: "1. Conflict Serializability: A schedule S is conflict serializable if it is conflict equivalent to some serial schedule S'. Conflicts occur when two operations belong to different transactions, access the same data item, and at least one is a write.\n\n2. Testing via Precedence Graph (Serialization Graph):\n   - Nodes: Active transactions T1, T2, ... Tn.\n   - Directed Edge Ti -> Tj exists if Ti performs an operation that conflicts with and executes before an operation of Tj.\n   - Rule: The schedule is Conflict Serializable IF AND ONLY IF the precedence graph contains NO CYCLES (Acyclic)."
    },
    {
        subject: "Database Management Systems",
        subjectCode: "CS402",
        year: 2022,
        examType: "Mid-Sem",
        question: "Explain the structure of B+ Trees. Why are B+ Trees preferred over B-Trees for database file indexing? Demonstrate an insertion sequence.",
        questionType: "Subjective",
        marks: 8,
        unit: "Unit 5",
        topic: "Indexing & Hashing",
        difficulty: "Medium",
        frequency: 4,
        tags: ["DBMS", "B+ Trees", "Indexing", "Storage"],
        solution: "Why B+ Trees are preferred over B-Trees:\n1. All record pointers are located exclusively in the leaf nodes, meaning internal nodes carry only search keys and child pointers, maximizing fanout.\n2. Leaf nodes are linked via a doubly linked list, enabling highly efficient range queries and sequential scans (O(log n) to find start, then O(k) linear scan).\n3. Equal path lengths from root to all leaves guarantees consistent O(log N) search times."
    },

    // --- COMPUTER NETWORKS ---
    {
        subject: "Computer Networks",
        subjectCode: "CS403",
        year: 2024,
        examType: "End-Sem",
        question: "Explain the OSI Reference Model layers and compare each with the TCP/IP architectural model. Specify the PDU (Protocol Data Unit) and key protocols at each layer.",
        questionType: "Subjective",
        marks: 10,
        unit: "Unit 1",
        topic: "Network Layer Architectures",
        difficulty: "Easy",
        frequency: 5,
        tags: ["Computer Networks", "OSI Model", "TCP/IP", "Protocols"],
        solution: "OSI 7 Layers & PDUs:\n7. Application - Data (HTTP, DNS, SMTP)\n6. Presentation - Data (SSL/TLS, ASCII, JPEG)\n5. Session - Data (Sockets, RPC)\n4. Transport - Segments (TCP, UDP)\n3. Network - Packets (IP, ICMP, OSPF)\n2. Data Link - Frames (Ethernet, PPP, ARP)\n1. Physical - Bits (Cables, Hubs, Signal Encoding)\n\nComparison:\nTCP/IP combines Application, Presentation, and Session into a single Application layer, and Data Link with Physical into Network Interface / Link layer."
    },
    {
        subject: "Computer Networks",
        subjectCode: "CS403",
        year: 2023,
        examType: "End-Sem",
        question: "An organization is granted the block 200.10.20.0/24. The administrator needs to create 4 subnets. Find the subnet mask, network address, usable host IP range, and broadcast address for each subnet.",
        questionType: "Numerical",
        marks: 10,
        unit: "Unit 3",
        topic: "IPv4 Subnetting & CIDR",
        difficulty: "Medium",
        frequency: 4,
        tags: ["Computer Networks", "Subnetting", "CIDR", "IPv4", "Numerical"],
        solution: "Total bits to borrow: 2^2 = 4 subnets -> borrow 2 bits.\nNew Prefix: /24 + 2 = /26 (Mask: 255.255.255.192).\nBlock size per subnet: 256 / 4 = 64 IP addresses (62 usable hosts).\n\n- Subnet 1: Net ID: 200.10.20.0/26 | Hosts: 200.10.20.1 to 200.10.20.62 | Broadcast: 200.10.20.63\n- Subnet 2: Net ID: 200.10.20.64/26 | Hosts: 200.10.20.65 to 200.10.20.126 | Broadcast: 200.10.20.127\n- Subnet 3: Net ID: 200.10.20.128/26 | Hosts: 200.10.20.129 to 200.10.20.190 | Broadcast: 200.10.20.191\n- Subnet 4: Net ID: 200.10.20.192/26 | Hosts: 200.10.20.193 to 200.10.20.254 | Broadcast: 200.10.20.255"
    },
    {
        subject: "Computer Networks",
        subjectCode: "CS403",
        year: 2022,
        examType: "End-Sem",
        question: "Explain the TCP Sliding Window Protocol for flow control. Contrast Stop-and-Wait, Go-Back-N, and Selective Repeat ARQ protocols with window size formulas.",
        questionType: "Analytical",
        marks: 8,
        unit: "Unit 4",
        topic: "Transport Layer & Flow Control",
        difficulty: "Medium",
        frequency: 3,
        tags: ["Computer Networks", "TCP", "Sliding Window", "Go-Back-N", "Selective Repeat"],
        solution: "ARQ Protocol Comparison:\n1. Stop-and-Wait: Sender window = 1, Receiver window = 1. Efficiency is poor on high bandwidth-delay products.\n2. Go-Back-N (GBN): Sender window = N (2^m - 1), Receiver window = 1. Re-transmits all frames from the lost frame onward upon timeout.\n3. Selective Repeat (SR): Sender window = 2^(m-1), Receiver window = 2^(m-1). Independent receiver buffers and selective ACK; re-transmits only damaged/lost frames."
    },

    // --- DATA STRUCTURES & ALGORITHMS ---
    {
        subject: "Data Structures & Algorithms",
        subjectCode: "CS301",
        year: 2024,
        examType: "End-Sem",
        question: "Explain the 0/1 Knapsack Problem using Dynamic Programming. Given capacity W = 8 and items with weights [2, 3, 4, 5] and values [3, 4, 5, 8], construct the DP table and trace selected items.",
        questionType: "Numerical",
        marks: 10,
        unit: "Unit 4",
        topic: "Dynamic Programming",
        difficulty: "Hard",
        frequency: 4,
        tags: ["DSA", "Dynamic Programming", "Knapsack", "Algorithms"],
        solution: "DP State Definition:\nDP[i][w] = maximum value using subset of first i items with weight limit w.\n\nRecurrence Relation:\nIf weight[i-1] <= w:\n  DP[i][w] = max(value[i-1] + DP[i-1][w - weight[i-1]], DP[i-1][w])\nElse:\n  DP[i][w] = DP[i-1][w]\n\nTime Complexity: O(N * W), Space Complexity: O(N * W).\nTraceback identifies items selected for maximum profit."
    },
    {
        subject: "Data Structures & Algorithms",
        subjectCode: "CS301",
        year: 2023,
        examType: "End-Sem",
        question: "Explain Dijkstra's Single Source Shortest Path algorithm on weighted graphs. Analyze its time complexity using an adjacency matrix versus a min-heap priority queue.",
        questionType: "Subjective",
        marks: 10,
        unit: "Unit 3",
        topic: "Graph Algorithms",
        difficulty: "Medium",
        frequency: 5,
        tags: ["DSA", "Graphs", "Dijkstra", "Shortest Path", "Greedy"],
        solution: "Dijkstra's Algorithm operates greedily:\n1. Initialize dist[src] = 0 and dist[v] = ∞ for all other vertices.\n2. Insert all vertices into priority queue.\n3. Extract min-distance vertex u. For each neighbor v of u, relax edge (u, v):\n   if dist[u] + weight(u, v) < dist[v]: dist[v] = dist[u] + weight(u, v).\n\nTime Complexity Analysis:\n- With Adjacency Matrix: O(V^2)\n- With Min-Heap Priority Queue: O((V + E) log V)."
    },

    // --- SOFTWARE ENGINEERING ---
    {
        subject: "Software Engineering",
        subjectCode: "CS404",
        year: 2024,
        examType: "End-Sem",
        question: "Explain the Agile Scrum framework. Detail the Scrum roles (Product Owner, Scrum Master, Developers), ceremonies (Sprint Planning, Daily Standup, Review, Retrospective), and artifacts.",
        questionType: "Subjective",
        marks: 10,
        unit: "Unit 1",
        topic: "Agile Methodologies & Scrum",
        difficulty: "Easy",
        frequency: 4,
        tags: ["Software Engineering", "Agile", "Scrum", "Sprint"],
        solution: "Scrum Pillars:\n1. Roles:\n   - Product Owner: Manages product backlog, defines user stories and acceptance criteria.\n   - Scrum Master: Facilitator, removes impediments, coaches agile principles.\n   - Developers: Cross-functional team delivering increment.\n2. Ceremonies:\n   - Sprint Planning: Defines sprint goal and backlog.\n   - Daily Standup: 15-minute sync on yesterday, today, blockers.\n   - Sprint Review: Product demo with stakeholders.\n   - Sprint Retrospective: Continuous team process improvement.\n3. Artifacts: Product Backlog, Sprint Backlog, Potentially Shippable Increment."
    }
];

/**
 * Auto-seeds the collection if empty
 */
export const ensureSeeded = async () => {
    try {
        const count = await PYQ.countDocuments();
        if (count === 0) {
            console.log('🌱 Seeding initial authentic PYQ bank dataset...');
            await PYQ.insertMany(INITIAL_PYQ_DATA);
            console.log(`✅ Seeded ${INITIAL_PYQ_DATA.length} initial PYQ entries`);
        }
    } catch (err) {
        console.error('Error auto-seeding PYQs:', err.message);
    }
};

// Call auto-seed immediately upon file loading
ensureSeeded();

/**
 * Get all PYQs with comprehensive filtering
 */
export const getAllPYQs = async (req, res) => {
    try {
        await ensureSeeded();

        const {
            subject,
            year,
            examType,
            difficulty,
            isPredicted,
            search,
            bookmarkedOnly,
            solvedOnly
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

        const pyqs = await PYQ.find(query)
            .sort({ isPredicted: -1, year: -1, createdAt: -1 })
            .lean();

        // Enhance with user-specific flags
        const enriched = pyqs.map(item => ({
            ...item,
            isBookmarked: Boolean(currentUserId && item.bookmarks?.some(id => id.toString() === currentUserId.toString())),
            isSolved: Boolean(currentUserId && item.solvedBy?.some(id => id.toString() === currentUserId.toString()))
        }));

        res.json({
            count: enriched.length,
            pyqs: enriched
        });
    } catch (error) {
        console.error('Error fetching PYQs:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch PYQs' });
    }
};

/**
 * Get distinct subject list with statistics
 */
export const getSubjectsList = async (req, res) => {
    try {
        await ensureSeeded();

        const subjects = await PYQ.aggregate([
            {
                $group: {
                    _id: "$subject",
                    count: { $sum: 1 },
                    years: { $addToSet: "$year" },
                    predictedCount: {
                        $sum: { $cond: ["$isPredicted", 1, 0] }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    name: "$_id",
                    count: 1,
                    years: 1,
                    predictedCount: 1
                }
            },
            { $sort: { count: -1 } }
        ]);

        const allYears = await PYQ.distinct("year");

        res.json({
            subjects,
            years: allYears.sort((a, b) => b - a)
        });
    } catch (error) {
        console.error('Error fetching subjects list:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch subjects' });
    }
};

/**
 * Get single PYQ by ID
 */
export const getPYQById = async (req, res) => {
    try {
        const pyq = await PYQ.findById(req.params.id);
        if (!pyq) {
            return res.status(400).json({ error: 'PYQ not found' });
        }
        res.json(pyq);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Create a new PYQ manually
 */
export const createPYQ = async (req, res) => {
    try {
        const {
            subject,
            subjectCode,
            year,
            examType,
            question,
            questionType,
            marks,
            unit,
            topic,
            solution,
            difficulty,
            tags
        } = req.body;

        if (!subject || !year || !question) {
            return res.status(400).json({ error: 'Subject, year, and question are required' });
        }

        const newPyq = new PYQ({
            subject,
            subjectCode: subjectCode || '',
            year: parseInt(year) || new Date().getFullYear(),
            examType: examType || 'End-Sem',
            question,
            questionType: questionType || 'Subjective',
            marks: parseInt(marks) || 5,
            unit: unit || 'Unit 1',
            topic: topic || 'General',
            solution: solution || '',
            difficulty: difficulty || 'Medium',
            tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : []),
            addedBy: req.user?._id || req.user?.userId
        });

        await newPyq.save();
        res.status(201).json({ message: 'PYQ created successfully', pyq: newPyq });
    } catch (error) {
        console.error('Error creating PYQ:', error);
        res.status(500).json({ error: error.message || 'Failed to create PYQ' });
    }
};

/**
 * Predict PYQs using AI Engine
 */
export const predictPYQs = async (req, res) => {
    try {
        const {
            subject,
            targetExam,
            topics,
            count,
            difficulty,
            syllabusText
        } = req.body;

        if (!subject || !subject.trim()) {
            return res.status(400).json({ error: 'Subject name is required for prediction' });
        }

        const predictions = await ai.predictPYQsService({
            subject: subject.trim(),
            targetExam: targetExam || 'End-Sem 2026',
            topics: topics || '',
            count: parseInt(count) || 5,
            difficulty: difficulty || 'Medium',
            syllabusText: syllabusText || ''
        });

        res.json({
            subject: subject.trim(),
            targetExam: targetExam || 'End-Sem 2026',
            count: predictions.length,
            predictions
        });
    } catch (error) {
        console.error('Predict PYQs Controller Error:', error);
        res.status(500).json({ error: error.message || 'Failed to predict PYQs' });
    }
};

/**
 * Save predicted questions into the PYQ Bank (single or bulk)
 */
export const savePredictedPYQs = async (req, res) => {
    try {
        const { questions, subject, targetExam } = req.body;
        const currentUserId = req.user?._id || req.user?.userId;

        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: 'No questions provided to save' });
        }

        const currentYear = new Date().getFullYear();

        const docsToInsert = questions.map(q => ({
            subject: q.subject || subject || 'Computer Science',
            subjectCode: q.subjectCode || '',
            year: q.year || currentYear,
            examType: q.examType || targetExam || 'End-Sem',
            question: q.question,
            questionType: q.questionType || 'Subjective',
            marks: q.marks || 5,
            unit: q.unit || 'Unit 1',
            topic: q.topic || 'Core Concept',
            solution: q.solution || '',
            difficulty: q.difficulty || 'Medium',
            isPredicted: true,
            predictionReasoning: q.predictionReasoning || 'Generated by AI Exam Predictor',
            probability: q.probability || 85,
            frequency: 1,
            addedBy: currentUserId,
            tags: q.tags || [q.subject || subject, 'Predicted', 'AI']
        }));

        const inserted = await PYQ.insertMany(docsToInsert);

        res.status(201).json({
            message: `Successfully added ${inserted.length} predicted question(s) to the PYQ Bank!`,
            count: inserted.length,
            savedQuestions: inserted
        });
    } catch (error) {
        console.error('Error saving predicted PYQs:', error);
        res.status(500).json({ error: error.message || 'Failed to save predicted PYQs' });
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
            return res.status(404).json({ error: 'PYQ not found' });
        }

        const isBookmarked = pyq.bookmarks.some(b => b.toString() === userId.toString());

        if (isBookmarked) {
            pyq.bookmarks = pyq.bookmarks.filter(b => b.toString() !== userId.toString());
        } else {
            pyq.bookmarks.push(userId);
        }

        await pyq.save();

        res.json({
            message: isBookmarked ? 'Bookmark removed' : 'Bookmarked successfully',
            isBookmarked: !isBookmarked
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Toggle solved status for a PYQ
 */
export const toggleSolved = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?._id || req.user?.userId;

        const pyq = await PYQ.findById(id);
        if (!pyq) {
            return res.status(404).json({ error: 'PYQ not found' });
        }

        const isSolved = pyq.solvedBy.some(s => s.toString() === userId.toString());

        if (isSolved) {
            pyq.solvedBy = pyq.solvedBy.filter(s => s.toString() !== userId.toString());
        } else {
            pyq.solvedBy.push(userId);
        }

        await pyq.save();

        res.json({
            message: isSolved ? 'Marked as unpracticed' : 'Marked as solved',
            isSolved: !isSolved
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
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
            return res.status(404).json({ error: 'PYQ not found' });
        }
        res.json({ message: 'PYQ deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Manually trigger re-seed
 */
export const seedPYQs = async (req, res) => {
    try {
        await PYQ.deleteMany({ isPredicted: false });
        await PYQ.insertMany(INITIAL_PYQ_DATA);
        res.json({ message: 'Initial PYQs reseeded successfully', count: INITIAL_PYQ_DATA.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
