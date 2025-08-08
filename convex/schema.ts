import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  documents: defineTable({
    title: v.string(),
    content: v.string(),
    fileType: v.string(),
    uploadedBy: v.id("users"),
    fileSize: v.number(),
    storageId: v.optional(v.id("_storage")),
    processedAt: v.optional(v.number()),
    chunks: v.optional(v.array(v.object({
      id: v.string(),
      content: v.string(),
      startIndex: v.number(),
      endIndex: v.number(),
    }))),
  })
    .index("by_user", ["uploadedBy"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["uploadedBy", "fileType"],
    }),

  queries: defineTable({
    userId: v.id("users"),
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
  })
    .index("by_user", ["userId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
