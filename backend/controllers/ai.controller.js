import * as ai from '../services/ai.services.js';
import * as hume from '../services/hume.services.js';

export const getResult = async (req, res) => {
    try {
        const { prompt } = req.query;
        const result = await ai.generateResult(prompt);
        res.send(result);
    }
    catch (error) {
        res.status(500).json({
            error: error.message
        })
    }
}

export const chat = async (req, res) => {
    try {
        const { message, systemPrompt, conversationHistory, useHume } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        let result;

        // Use Hume AI for mock interviews (more natural, empathetic responses)
        if (useHume) {
            console.log('🎭 Using Hume AI for interview conversation');
            result = await hume.generateInterviewResponse(
                conversationHistory || [],
                message,
                systemPrompt
            );
        } else {
            // Use Groq for other features
            console.log('🤖 Using Groq AI for chat');
            result = await ai.generateChatCompletion(
                conversationHistory || [],
                message,
                systemPrompt,
                'MOCK_INTERVIEW'
            );
        }

        res.json({ response: result.trim() });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({
            error: error.message || 'Failed to generate response'
        });
    }
}

export const generateQuiz = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const numQuestions = parseInt(req.body.numQuestions) || 5;
        const customSubject = (req.body.custom_subject || '').trim();

        // Use local RAG only when explicitly requested
        const useLocal = req.body.useLocal === 'true';

        let quiz;
        if (useLocal) {
            console.log(`📝 Generating quiz LOCALLY from ${req.file.originalname}`);
            try {
                quiz = await ai.generateQuizLocal(req.file, numQuestions);
            } catch (localError) {
                console.warn('⚠️ Local RAG unavailable, falling back to Cloud AI:', localError.message);
                console.log(`☁️ Falling back to CLOUD generation for ${req.file.originalname}`);
                quiz = await ai.generateQuizService(req.file, numQuestions, customSubject);
            }
        } else {
            console.log(`📝 Generating quiz via CLOUD from ${req.file.originalname}`);
            quiz = await ai.generateQuizService(req.file, numQuestions, customSubject);
        }

        res.json(quiz);

    } catch (error) {
        console.error('Quiz Generation Controller Error:', error);
        res.status(500).json({
            message: error.message || 'Failed to generate quiz'
        });
    }
}