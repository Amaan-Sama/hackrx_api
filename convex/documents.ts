import { v } from "convex/values";
import { mutation, query, action, internalAction, internalQuery, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveDocument = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    storageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const documentId = await ctx.db.insert("documents", {
      title: args.title,
      content: args.content,
      fileType: args.fileType,
      fileSize: args.fileSize,
      uploadedBy: userId,
      storageId: args.storageId,
    });

    // Schedule document processing
    await ctx.scheduler.runAfter(0, internal.documents.processDocument, {
      documentId,
    });

    return documentId;
  },
});

export const processDocument = internalAction({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const document = await ctx.runQuery(internal.documents.getDocument, {
      documentId: args.documentId,
    });

    if (!document) {
      throw new Error("Document not found");
    }

    // Split document into chunks for better processing
    const chunks = splitIntoChunks(document.content, 1000, 200);
    
    await ctx.runMutation(internal.documents.updateDocumentChunks, {
      documentId: args.documentId,
      chunks: chunks.map((chunk, index) => ({
        id: `${args.documentId}-${index}`,
        content: chunk.content,
        startIndex: chunk.startIndex,
        endIndex: chunk.endIndex,
      })),
    });
  },
});

export const getDocument = internalQuery({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const document = await ctx.db.get(args.documentId);
    if (!document || document.uploadedBy !== userId) {
      return null;
    }

    return document;
  },
});

export const updateDocumentChunks = internalMutation({
  args: {
    documentId: v.id("documents"),
    chunks: v.array(v.object({
      id: v.string(),
      content: v.string(),
      startIndex: v.number(),
      endIndex: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.documentId, {
      chunks: args.chunks,
      processedAt: Date.now(),
    });
  },
});

export const listDocuments = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    return await ctx.db
      .query("documents")
      .withIndex("by_user", (q) => q.eq("uploadedBy", userId))
      .order("desc")
      .collect();
  },
});

export const deleteDocument = mutation({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const document = await ctx.db.get(args.documentId);
    if (!document || document.uploadedBy !== userId) {
      throw new Error("Document not found or unauthorized");
    }

    await ctx.db.delete(args.documentId);
  },
});

// Helper function to split text into overlapping chunks
function splitIntoChunks(text: string, chunkSize: number, overlap: number) {
  const chunks = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + chunkSize, text.length);
    const content = text.slice(startIndex, endIndex);
    
    chunks.push({
      content,
      startIndex,
      endIndex,
    });

    if (endIndex === text.length) break;
    startIndex = endIndex - overlap;
  }

  return chunks;
}
