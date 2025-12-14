import React, { useEffect, useState } from 'react';
import { X, Mail, Loader, Search, Calendar, Paperclip } from 'lucide-react';
import { googleAPI } from '../services/api';

export default function EmailAttachmentModal({ taskId, onClose, onEmailsAttached }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmails, setSelectedEmails] = useState(new Set());
  const [attaching, setAttaching] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    loadEmails();
  }, []);

  const loadEmails = async () => {
    try {
      setLoading(true);

      // Build Gmail query with date filters and search term
      let query = 'in:inbox OR in:sent';

      if (dateFrom) {
        query += ` after:${formatDateForGmail(dateFrom)}`;
      }
      if (dateTo) {
        query += ` before:${formatDateForGmail(dateTo)}`;
      }
      if (searchQuery.trim()) {
        query += ` ${searchQuery.trim()}`;
      }

      const response = await googleAPI.getGmailMessages(50, null, query);
      setEmails(response.messages || []);
    } catch (error) {
      console.error('Error loading emails:', error);
      alert('Failed to load emails');
    } finally {
      setLoading(false);
    }
  };

  // Format date to Gmail query format (YYYY/MM/DD)
  const formatDateForGmail = (dateString) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  };

  // Format display date
  const formatDisplayDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadEmails();
  };

  const toggleEmailSelection = (emailId) => {
    setSelectedEmails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
      } else {
        newSet.add(emailId);
      }
      return newSet;
    });
  };

  const handleAttachSelected = async () => {
    if (selectedEmails.size === 0) {
      alert('Please select at least one email');
      return;
    }

    try {
      setAttaching(true);
      const messageIds = Array.from(selectedEmails);
      await googleAPI.attachEmailToTask(taskId, messageIds);
      if (onEmailsAttached) onEmailsAttached();
      onClose();
    } catch (error) {
      console.error('Error attaching emails:', error);
      alert('Failed to attach emails');
    } finally {
      setAttaching(false);
    }
  };

  const selectAll = () => {
    if (selectedEmails.size === emails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(emails.map(e => e.id)));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Attach Emails from Gmail</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <form onSubmit={handleSearch} className="space-y-3">
            {/* Search */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by subject, sender, or content..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Date Range */}
            <div className="flex gap-2 items-center">
              <Calendar className="w-4 h-4 text-gray-500" />
              <label className="text-sm text-gray-700">From:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <label className="text-sm text-gray-700 ml-2">To:</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="submit"
                className="ml-auto px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Search
              </button>
            </div>
          </form>
        </div>

        {/* Selection Controls */}
        {!loading && emails.length > 0 && (
          <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={selectAll}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                {selectedEmails.size === emails.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="text-sm text-gray-600">
                {selectedEmails.size} of {emails.length} selected
              </span>
            </div>
          </div>
        )}

        {/* Emails List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-primary-600" />
            </div>
          ) : emails.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No emails found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your search or date filters</p>
            </div>
          ) : (
            <div className="space-y-2">
              {emails.map((email) => (
                <div
                  key={email.id}
                  onClick={() => toggleEmailSelection(email.id)}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedEmails.has(email.id)
                      ? 'bg-primary-50 border-primary-300'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedEmails.has(email.id)}
                    onChange={() => {}}
                    className="mt-1 w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {email.subject || '(No subject)'}
                        </p>
                        <p className="text-xs text-gray-600 truncate mt-0.5">
                          {email.from}
                        </p>
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {formatDisplayDate(email.date)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {email.snippet}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {selectedEmails.size > 0 && (
              <span>{selectedEmails.size} email{selectedEmails.size !== 1 ? 's' : ''} will be attached</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAttachSelected}
              disabled={selectedEmails.size === 0 || attaching}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {attaching ? 'Attaching...' : `Attach Selected (${selectedEmails.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
