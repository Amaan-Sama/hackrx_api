import { useState, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function DocumentManager() {
  const documents = useQuery(api.documents.listDocuments) || [];
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const saveDocument = useMutation(api.documents.saveDocument);
  const deleteDocument = useMutation(api.documents.deleteDocument);
  
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    const allowedTypes = ['text/plain', 'application/pdf', 'text/html'];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.txt')) {
      toast.error('Please upload a text file, PDF, or HTML file');
      return;
    }

    setIsUploading(true);
    
    try {
      // Read file content
      const content = await readFileContent(file);
      
      // Generate upload URL for file storage
      const uploadUrl = await generateUploadUrl();
      
      // Upload file to storage
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      
      if (!result.ok) {
        throw new Error('Failed to upload file');
      }
      
      const { storageId } = await result.json();
      
      // Save document metadata and content
      await saveDocument({
        title: file.name,
        content,
        fileType: file.type,
        fileSize: file.size,
        storageId,
      });
      
      toast.success('Document uploaded successfully!');
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (documentId: any) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    try {
      await deleteDocument({ documentId });
      toast.success('Document deleted successfully');
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-semibold mb-4">Upload Documents</h2>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.pdf,.html"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
          />
          <div className="space-y-4">
            <div className="text-gray-500">
              <svg className="mx-auto h-12 w-12" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isUploading ? 'Uploading...' : 'Choose File'}
              </button>
              <p className="text-sm text-gray-500 mt-2">
                Supports: Text files (.txt), PDF files (.pdf), HTML files (.html)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Your Documents ({documents.length})</h2>
        </div>
        
        {documents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No documents uploaded yet.</p>
            <p className="text-sm mt-1">Upload your first document to get started!</p>
          </div>
        ) : (
          <div className="divide-y">
            {documents.map((doc) => (
              <div key={doc._id} className="p-6 flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{doc.title}</h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                    <span>{formatFileSize(doc.fileSize)}</span>
                    <span>{doc.fileType}</span>
                    <span>
                      {new Date(doc._creationTime).toLocaleDateString()}
                    </span>
                    {doc.processedAt && (
                      <span className="text-green-600">✓ Processed</span>
                    )}
                  </div>
                  {doc.chunks && (
                    <div className="text-xs text-gray-400 mt-1">
                      {doc.chunks.length} chunks created
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(doc._id)}
                  className="text-red-600 hover:text-red-800 p-2"
                  title="Delete document"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
