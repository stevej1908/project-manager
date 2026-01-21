import React, { useEffect, useState } from 'react';
import { X, User, Loader, Search, Check } from 'lucide-react';
import { googleAPI } from '../services/api';

export default function ContactsPickerModal({
  onClose,
  onContactsSelected,
  multiSelect = true,
  title = 'Select Contacts'
}) {
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContacts, setSelectedContacts] = useState([]);

  useEffect(() => {
    loadContacts();
  }, []);

  useEffect(() => {
    // Filter contacts based on search query (case-insensitive, multi-word support)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const searchWords = query.split(/\s+/); // Split by whitespace

      const filtered = contacts.filter(contact => {
        const name = (contact.name || '').toLowerCase();
        const email = (contact.email || '').toLowerCase();
        const searchText = `${name} ${email}`;

        // Match if ALL search words are found in name or email
        return searchWords.every(word => searchText.includes(word));
      });

      setFilteredContacts(filtered);
      console.log(`Search "${searchQuery}": found ${filtered.length} contacts`);
    } else {
      setFilteredContacts(contacts);
    }
  }, [searchQuery, contacts]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      // Fetch up to 1000 contacts (Google's max per request)
      const response = await googleAPI.getContacts(1000);
      const contactsList = response.contacts || [];

      // Backend already formats contacts with name, email, photo, googleId
      // Just filter out contacts without emails
      const processedContacts = contactsList.filter(contact => contact.email);

      console.log(`Loaded ${processedContacts.length} contacts with emails`);

      // Log contacts that match "bob" or "matt" to debug
      const bobContacts = processedContacts.filter(c =>
        c.name.toLowerCase().includes('bob') || c.email.toLowerCase().includes('bob')
      );
      const mattContacts = processedContacts.filter(c =>
        c.name.toLowerCase().includes('matt') || c.email.toLowerCase().includes('matt')
      );
      console.log('Bob contacts:', bobContacts.map(c => `${c.name} <${c.email}>`));
      console.log('Matt contacts:', mattContacts.map(c => `${c.name} <${c.email}>`));

      setContacts(processedContacts);
      setFilteredContacts(processedContacts);
    } catch (error) {
      console.error('Error loading contacts:', error);
      alert('Failed to load Google Contacts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleContactClick = (contact) => {
    if (multiSelect) {
      // Toggle selection for multi-select mode
      setSelectedContacts(prev => {
        const isSelected = prev.some(c => c.email === contact.email);
        if (isSelected) {
          return prev.filter(c => c.email !== contact.email);
        } else {
          return [...prev, contact];
        }
      });
    } else {
      // Single-select mode - immediately call callback and close
      onContactsSelected([contact]);
      onClose();
    }
  };

  const handleConfirm = () => {
    if (selectedContacts.length > 0) {
      onContactsSelected(selectedContacts);
      onClose();
    }
  };

  const isContactSelected = (contact) => {
    return selectedContacts.some(c => c.email === contact.email);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts by name or email..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-primary-600" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                {searchQuery ? 'No contacts found matching your search' : 'No contacts available'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredContacts.map((contact) => {
                const selected = isContactSelected(contact);
                return (
                  <div
                    key={contact.resourceName}
                    onClick={() => handleContactClick(contact)}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selected
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {/* Photo or Placeholder */}
                    {contact.photo ? (
                      <img
                        src={contact.photo}
                        alt={contact.name}
                        className="w-10 h-10 rounded-full flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-gray-500" />
                      </div>
                    )}

                    {/* Contact Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {contact.name}
                      </p>
                      <p className="text-xs text-gray-600 truncate">
                        {contact.email}
                      </p>
                    </div>

                    {/* Selection Indicator */}
                    {multiSelect && selected && (
                      <div className="flex-shrink-0">
                        <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {multiSelect && (
          <div className="flex items-center justify-between p-4 border-t border-gray-200">
            <span className="text-sm text-gray-600">
              {selectedContacts.length} contact{selectedContacts.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={selectedContacts.length === 0}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Selected
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
