import React, { useState, useEffect, useContext } from 'react';
import { ProjectContext } from '../context/ProjectContext';
import { googleAPI } from '../services/api';
import { X, Mail } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

export default function GmailPickerModal({ projectId, onClose }) {
  const { createTask, loadTasks } = useContext(ProjectContext);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      const { messages: msgs } = await googleAPI.getGmailMessages(20);
      setMessages(msgs);
    } catch (error) {
      console.error('Error loading Gmail messages:', error);
      alert('Failed to load Gmail messages');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (message) => {
    try {
      setCreating(true);
      await createTask({
        project_id: projectId,
        title: message.subject || 'Email task',
        description: `From: ${message.from}\n\n${message.snippet}`,
        gmail_message_id: message.id,
        gmail_thread_id: message.threadId,
        status: 'todo',
      });
      await loadTasks(projectId);
      onClose();
    } catch (error) {
      alert('Failed to create task from email');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create Task from Gmail</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <LoadingSpinner />
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => !creating && handleCreateTask(message)}
                >
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-gray-400 mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {message.subject}
                      </div>
                      <div className="text-xs text-gray-600 truncate">{message.from}</div>
                      <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {message.snippet}
                      </div>
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
