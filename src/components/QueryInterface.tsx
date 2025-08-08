import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function QueryInterface() {
  const [query, setQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentResult, setCurrentResult] = useState<any>(null);
  
  const processQuery = useAction(api.queries.processQuery);
  const queryHistory = useQuery(api.queries.getQueryHistory) || [];
  const documents = useQuery(api.documents.listDocuments) || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    if (documents.length === 0) {
      toast.error("Please upload some documents first before querying.");
      return;
    }

    setIsProcessing(true);
    setCurrentResult(null);

    try {
      const result = await processQuery({ query });
      setCurrentResult(result);
      setQuery("");
    } catch (error: any) {
      toast.error(error.message || "Failed to process query");
    } finally {
      setIsProcessing(false);
    }
  };

  const formatProcessingTime = (ms: number) => {
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="space-y-6">
      {/* Query Input */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-semibold mb-4">Ask a Question</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything about your documents... e.g., 'What are the key policies mentioned?' or 'Summarize the main points about data privacy'"
              className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={4}
              disabled={isProcessing}
            />
          </div>
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              {documents.length} document{documents.length !== 1 ? 's' : ''} available for querying
            </p>
            <button
              type="submit"
              disabled={!query.trim() || isProcessing || documents.length === 0}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? "Processing..." : "Ask Question"}
            </button>
          </div>
        </form>
      </div>

      {/* Current Result */}
      {currentResult && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold">Answer</h3>
            <span className="text-sm text-gray-500">
              Processed in {formatProcessingTime(currentResult.processingTime)}
            </span>
          </div>
          
          <div className="prose max-w-none mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              {currentResult.answer}
            </div>
          </div>

          {currentResult.sources.length > 0 && (
            <div>
              <h4 className="font-medium mb-3">Sources Referenced:</h4>
              <div className="space-y-3">
                {currentResult.sources.map((source: any, index: number) => (
                  <div key={index} className="border-l-4 border-blue-200 pl-4 py-2">
                    <div className="flex justify-between items-start mb-2">
                      <h5 className="font-medium text-sm">
                        Source {index + 1}: {source.documentTitle}
                      </h5>
                      <span className="text-xs text-gray-500">
                        Confidence: {(source.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                      "{source.relevantChunk}"
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Characters {source.startIndex}-{source.endIndex}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Query History */}
      {queryHistory.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Recent Queries</h3>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {queryHistory.map((item) => (
              <div key={item._id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium text-sm">{item.query}</p>
                  <span className="text-xs text-gray-500">
                    {new Date(item._creationTime).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{item.response}</p>
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>{item.sources.length} sources used</span>
                  <span>{formatProcessingTime(item.processingTime)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
