import React, { useEffect, useState } from 'react';
import { X, File, Loader, Search, Folder } from 'lucide-react';
import { googleAPI } from '../services/api';

export default function DriveFilePicker({ taskId, onClose, onFileAttached }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [attaching, setAttaching] = useState(null);
  const [activeTab, setActiveTab] = useState('myDrive'); // 'myDrive' or 'sharedDrives'
  const [sharedDrives, setSharedDrives] = useState([]);
  const [selectedDriveId, setSelectedDriveId] = useState(null);
  const [loadingDrives, setLoadingDrives] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folderPath, setFolderPath] = useState([{ id: null, name: 'My Drive' }]);

  useEffect(() => {
    loadDriveFiles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedDriveId, currentFolderId]);

  const loadDriveFiles = async () => {
    try {
      setLoading(true);
      const driveType = activeTab === 'myDrive' ? 'user' : 'shared';
      const response = await googleAPI.listDriveFiles(
        100, // Increased from 50 to show more items
        null,
        searchQuery || null,
        driveType,
        selectedDriveId,
        currentFolderId
      );
      setFiles(response.files || []);
    } catch (error) {
      console.error('Error loading Drive files:', error);
      alert('Failed to load Drive files');
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = (folder) => {
    setCurrentFolderId(folder.id);
    setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
  };

  const handleBreadcrumbClick = (index) => {
    const newPath = folderPath.slice(0, index + 1);
    const targetFolder = newPath[newPath.length - 1];
    setCurrentFolderId(targetFolder.id);
    setFolderPath(newPath);
  };

  const loadSharedDrives = async () => {
    try {
      setLoadingDrives(true);
      const response = await googleAPI.listSharedDrives(50);
      setSharedDrives(response.drives || []);
    } catch (error) {
      console.error('Error loading shared drives:', error);
      alert('Failed to load shared drives');
    } finally {
      setLoadingDrives(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedDriveId(null);
    setSearchQuery('');
    setCurrentFolderId(null);
    setFolderPath([{ id: null, name: tab === 'myDrive' ? 'My Drive' : 'Shared Drives' }]);
    if (tab === 'sharedDrives' && sharedDrives.length === 0) {
      loadSharedDrives();
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadDriveFiles();
  };

  const handleAttachFile = async (file) => {
    try {
      setAttaching(file.id);
      await googleAPI.attachDriveFile(taskId, file.id);
      if (onFileAttached) onFileAttached();
      onClose();
    } catch (error) {
      console.error('Error attaching file:', error);
      alert('Failed to attach file');
    } finally {
      setAttaching(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Attach from Google Drive</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => handleTabChange('myDrive')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'myDrive'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            My Drive
          </button>
          <button
            onClick={() => handleTabChange('sharedDrives')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'sharedDrives'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Shared Drives
          </button>
        </div>

        {/* Shared Drives Selector */}
        {activeTab === 'sharedDrives' && (
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            {loadingDrives ? (
              <div className="flex items-center justify-center py-4">
                <Loader className="w-5 h-5 animate-spin text-primary-600" />
              </div>
            ) : sharedDrives.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-2">No shared drives found</p>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700">Select a Shared Drive:</label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => setSelectedDriveId(null)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
                      selectedDriveId === null
                        ? 'bg-primary-50 border-primary-500 text-primary-700'
                        : 'bg-white border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Folder className="w-4 h-4" />
                    <span>All Shared Drives</span>
                  </button>
                  {sharedDrives.map((drive) => (
                    <button
                      key={drive.id}
                      onClick={() => setSelectedDriveId(drive.id)}
                      className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
                        selectedDriveId === drive.id
                          ? 'bg-primary-50 border-primary-500 text-primary-700'
                          : 'bg-white border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <Folder className="w-4 h-4" />
                      <span className="truncate">{drive.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${activeTab === 'myDrive' ? 'My Drive' : 'Shared Drives'}...`}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Search
            </button>
          </form>
        </div>

        {/* Breadcrumb Navigation */}
        {!searchQuery && (
          <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-1 text-sm overflow-x-auto">
              {folderPath.map((folder, index) => (
                <React.Fragment key={folder.id || 'root'}>
                  <button
                    onClick={() => handleBreadcrumbClick(index)}
                    className={`px-2 py-1 rounded hover:bg-gray-200 transition-colors ${
                      index === folderPath.length - 1 ? 'font-semibold text-primary-600' : 'text-gray-600'
                    }`}
                  >
                    {folder.name}
                  </button>
                  {index < folderPath.length - 1 && <span className="text-gray-400">/</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Files List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-primary-600" />
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No files found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {files
                .filter((file) => file.mimeType === 'application/vnd.google-apps.folder')
                .map((folder) => (
                  <div
                    key={folder.id}
                    onClick={() => handleFolderClick(folder)}
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer"
                  >
                    <Folder className="w-10 h-10 text-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{folder.name}</p>
                      <p className="text-xs text-gray-500">Folder</p>
                    </div>
                  </div>
                ))}
              {files
                .filter((file) => file.mimeType !== 'application/vnd.google-apps.folder')
                .map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {file.thumbnailLink ? (
                        <img
                          src={file.thumbnailLink}
                          alt={file.name}
                          className="w-10 h-10 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                          <File className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500 truncate">{file.mimeType}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAttachFile(file)}
                      disabled={attaching === file.id}
                      className="ml-3 px-3 py-1.5 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      {attaching === file.id ? 'Attaching...' : 'Attach'}
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
