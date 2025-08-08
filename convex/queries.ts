import { v } from "convex/values";
import { action, mutation, query, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.CONVEX_OPENAI_BASE_URL,
  apiKey: process.env.CONVEX_OPENAI_API_KEY,
});

export const processQuery = action({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();
    
    // Get user documents
    const documents = await ctx.runQuery(api.documents.listDocuments);
    
    if (documents.length === 0) {
      throw new Error("No documents available. Please upload some documents first.");
    }

    // Find relevant document chunks using semantic search
    const relevantSources = await findRelevantSources(ctx, args.query, documents);
    
    // Generate response using LLM
    const response = await generateResponse(args.query, relevantSources);
    
    const processingTime = Date.now() - startTime;
    
    // Save query and response
    await ctx.runMutation(internal.queries.saveQuery, {
      query: args.query,
      response: response.answer,
      sources: relevantSources,
      processingTime,
    });

    return {
      answer: response.answer,
      sources: relevantSources,
      processingTime,
    };
  },
});

export const saveQuery = internalMutation({
  args: {
    query: v.string(),
    response: v.string(),
    sources: v.array(v.object({
      documentId: v.id("documents"),
      documentTitle: v.string(),
      relevantChunk: v.string(),
      confidence: v.number(),
      startIndex: v.number(),
      endIndex: v.number(),
    })),
    processingTime: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db.insert("queries", {
      userId,
      query: args.query,
      response: args.response,
      sources: args.sources,
      processingTime: args.processingTime,
    });
  },
});

export const getQueryHistory = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    return await ctx.db
      .query("queries")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
  },
});

async function findRelevantSources(ctx: any, query: string, documents: any[]) {
  const relevantSources = [];
  
  // Use simple text search for now (in production, you'd use vector embeddings)
  for (const doc of documents) {
    if (!doc.chunks) continue;
    
    for (const chunk of doc.chunks) {
      const similarity = calculateTextSimilarity(query.toLowerCase(), chunk.content.toLowerCase());
      
      if (similarity > 0.1) { // Threshold for relevance
        relevantSources.push({
          documentId: doc._id,
          documentTitle: doc.title,
          relevantChunk: chunk.content,
          confidence: similarity,
          startIndex: chunk.startIndex,
          endIndex: chunk.endIndex,
        });
      }
    }
  }
  
  // Sort by confidence and take top 5
  return relevantSources
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

async function generateResponse(query: string, sources: any[]) {
  const context = sources
    .map((source, index) => `[Source ${index + 1}] ${source.documentTitle}: ${source.relevantChunk}`)
    .join('\n\n');

  const prompt = `You are a helpful assistant that answers questions based on provided document sources. 
Always reference the specific sources you use in your answer.

Context from documents:
${context}

Question: ${query}

Please provide a comprehensive answer based on the provided sources. If you reference information, mention which source number you're using (e.g., "According to Source 1...").`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant that provides accurate answers based on document sources. Always cite your sources."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.3,
  });

  return {
    answer: completion.choices[0].message.content || "I couldn't generate a response.",
  };
}

// Simple text similarity calculation (in production, use proper embeddings)
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = text1.split(/\s+/);
  const words2 = text2.split(/\s+/);
  
  const commonWords = words1.filter(word => 
    word.length > 3 && words2.includes(word)
  );
  
  return commonWords.length / Math.max(words1.length, words2.length);
}
