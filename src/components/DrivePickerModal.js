import React, { useState, useEffect } from 'react';
import { googleAPI } from '../services/api';
import { X, FileIcon } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

export default function DrivePickerModal({ taskId, onClose, onAttach }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [attaching, setAttaching] = useState(false);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      const { files: driveFiles } = await googleAPI.listDriveFiles(20);
      setFiles(driveFiles);
    } catch (error) {
      console.error('Error loading Drive files:', error);
      alert('Failed to load Google Drive files');
    } finally {
      setLoading(false);
    }
  };

  const handleAttach = async (file) => {
    try {
      setAttaching(true);
      await googleAPI.attachDriveFile(taskId, file.id);
      if (onAttach) onAttach();
      onClose();
    } catch (error) {
      alert('Failed to attach file');
    } finally {
      setAttaching(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Attach from Google Drive</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <LoadingSpinner />
          ) : (
            <div className="space-y-3">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => !attaching && handleAttach(file)}
                >
                  <div className="flex items-center gap-3">
                    <FileIcon className="w-5 h-5 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </div>
                      <div className="text-xs text-gray-500">{file.mimeType}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
