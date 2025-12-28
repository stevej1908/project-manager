const { google } = require('googleapis');
const { pool } = require('../config/database');

// Helper function to get OAuth2 client with user's tokens
async function getUserOAuth2Client(userId) {
  const result = await pool.query(
    'SELECT access_token, refresh_token FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error('User not found');
  }

  const { access_token, refresh_token } = result.rows[0];

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token,
    refresh_token
  });

  // Handle token refresh
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.refresh_token) {
      await pool.query(
        'UPDATE users SET access_token = $1, refresh_token = $2, token_expiry = $3 WHERE id = $4',
        [tokens.access_token, tokens.refresh_token, new Date(tokens.expiry_date), userId]
      );
    } else {
      await pool.query(
        'UPDATE users SET access_token = $1, token_expiry = $2 WHERE id = $3',
        [tokens.access_token, new Date(tokens.expiry_date), userId]
      );
    }
  });

  return oauth2Client;
}

// Get Google Contacts
const getContacts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pageSize = 50, pageToken } = req.query;

    const auth = await getUserOAuth2Client(userId);
    const people = google.people({ version: 'v1', auth });

    const response = await people.people.connections.list({
      resourceName: 'people/me',
      pageSize: parseInt(pageSize),
      pageToken,
      personFields: 'names,emailAddresses,photos'
    });

    const contacts = response.data.connections || [];

    // Format contacts for easier use
    const formattedContacts = contacts.map(contact => ({
      resourceName: contact.resourceName,
      etag: contact.etag,
      name: contact.names?.[0]?.displayName || '',
      email: contact.emailAddresses?.[0]?.value || '',
      photo: contact.photos?.[0]?.url || null,
      googleId: contact.resourceName.replace('people/', '')
    }));

    res.json({
      contacts: formattedContacts,
      nextPageToken: response.data.nextPageToken || null,
      totalPeople: response.data.totalPeople || formattedContacts.length
    });
  } catch (error) {
    console.error('Error getting contacts:', error);
    res.status(500).json({
      error: 'Failed to get contacts',
      message: error.message
    });
  }
};

// Search contacts
const searchContacts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const auth = await getUserOAuth2Client(userId);
    const people = google.people({ version: 'v1', auth });

    const response = await people.people.searchContacts({
      query,
      readMask: 'names,emailAddresses,photos',
      pageSize: 20
    });

    const results = response.data.results || [];

    // Format search results
    const formattedResults = results.map(result => {
      const contact = result.person;
      return {
        resourceName: contact.resourceName,
        name: contact.names?.[0]?.displayName || '',
        email: contact.emailAddresses?.[0]?.value || '',
        photo: contact.photos?.[0]?.url || null,
        googleId: contact.resourceName.replace('people/', '')
      };
    });

    res.json({ contacts: formattedResults });
  } catch (error) {
    console.error('Error searching contacts:', error);
    res.status(500).json({
      error: 'Failed to search contacts',
      message: error.message
    });
  }
};

// Get Gmail messages
const getGmailMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { maxResults = 20, pageToken, q } = req.query;

    const auth = await getUserOAuth2Client(userId);
    const gmail = google.gmail({ version: 'v1', auth });

    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: parseInt(maxResults),
      pageToken,
      q: q || 'in:inbox' // Default to inbox
    });

    const messages = response.data.messages || [];

    // Get message details
    const detailedMessages = await Promise.all(
      messages.map(async (msg) => {
        try {
          const detail = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Subject', 'Date']
          });

          const headers = detail.data.payload.headers;
          return {
            id: msg.id,
            threadId: msg.threadId,
            from: headers.find(h => h.name === 'From')?.value || '',
            to: headers.find(h => h.name === 'To')?.value || '',
            subject: headers.find(h => h.name === 'Subject')?.value || '',
            date: headers.find(h => h.name === 'Date')?.value || '',
            snippet: detail.data.snippet
          };
        } catch (err) {
          console.error(`Error getting message ${msg.id}:`, err);
          return null;
        }
      })
    );

    res.json({
      messages: detailedMessages.filter(m => m !== null),
      nextPageToken: response.data.nextPageToken || null,
      resultSizeEstimate: response.data.resultSizeEstimate || 0
    });
  } catch (error) {
    console.error('Error getting Gmail messages:', error);
    res.status(500).json({
      error: 'Failed to get Gmail messages',
      message: error.message
    });
  }
};

// Get single Gmail message
const getGmailMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;

    const auth = await getUserOAuth2Client(userId);
    const gmail = google.gmail({ version: 'v1', auth });

    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });

    const message = response.data;
    const headers = message.payload.headers;

    // Extract body
    let body = '';
    if (message.payload.body.data) {
      body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    } else if (message.payload.parts) {
      const textPart = message.payload.parts.find(part => part.mimeType === 'text/plain');
      if (textPart && textPart.body.data) {
        body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
      }
    }

    res.json({
      id: message.id,
      threadId: message.threadId,
      from: headers.find(h => h.name === 'From')?.value || '',
      to: headers.find(h => h.name === 'To')?.value || '',
      subject: headers.find(h => h.name === 'Subject')?.value || '',
      date: headers.find(h => h.name === 'Date')?.value || '',
      body,
      snippet: message.snippet
    });
  } catch (error) {
    console.error('Error getting Gmail message:', error);
    res.status(500).json({
      error: 'Failed to get Gmail message',
      message: error.message
    });
  }
};

// Attach Drive file to task
const attachDriveFile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId, fileId } = req.body;

    if (!taskId || !fileId) {
      return res.status(400).json({
        error: 'Task ID and file ID are required'
      });
    }

    // Check if user has access to the task
    const taskCheck = await pool.query(
      `SELECT t.id FROM tasks t
       INNER JOIN projects p ON t.project_id = p.id
       LEFT JOIN project_members pm ON p.id = pm.project_id
       WHERE t.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)`,
      [taskId, userId]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Task not found or access denied'
      });
    }

    // Get file metadata from Google Drive
    const auth = await getUserOAuth2Client(userId);
    const drive = google.drive({ version: 'v3', auth });

    const fileResponse = await drive.files.get({
      fileId,
      fields: 'id,name,mimeType,size,webViewLink,thumbnailLink'
    });

    const file = fileResponse.data;

    // Save attachment to database
    const result = await pool.query(
      `INSERT INTO task_attachments (
        task_id, drive_file_id, file_name, file_type, file_size,
        drive_url, thumbnail_url, uploaded_by
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        taskId,
        file.id,
        file.name,
        file.mimeType,
        file.size,
        file.webViewLink,
        file.thumbnailLink,
        userId
      ]
    );

    res.status(201).json({ attachment: result.rows[0] });
  } catch (error) {
    console.error('Error attaching Drive file:', error);
    res.status(500).json({
      error: 'Failed to attach Drive file',
      message: error.message
    });
  }
};

// List Shared Drives
const listSharedDrives = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pageSize = 20, pageToken } = req.query;

    const auth = await getUserOAuth2Client(userId);
    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.drives.list({
      pageSize: parseInt(pageSize),
      pageToken,
      fields: 'nextPageToken, drives(id, name, kind)'
    });

    res.json({
      drives: response.data.drives || [],
      nextPageToken: response.data.nextPageToken || null
    });
  } catch (error) {
    console.error('Error listing shared drives:', error);
    res.status(500).json({
      error: 'Failed to list shared drives',
      message: error.message
    });
  }
};

// List Drive files
const listDriveFiles = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pageSize = 20, pageToken, q, driveId, driveType = 'user' } = req.query;

    const auth = await getUserOAuth2Client(userId);
    const drive = google.drive({ version: 'v3', auth });

    // Build proper Drive query syntax
    let query = "trashed=false";
    if (q && q.trim()) {
      // Escape single quotes in the search query
      const escapedQuery = q.trim().replace(/'/g, "\\'");
      // Search in name and fullText (content)
      query = `(name contains '${escapedQuery}' or fullText contains '${escapedQuery}') and trashed=false`;
    }

    // Build request options
    const requestOptions = {
      pageSize: parseInt(pageSize),
      pageToken,
      q: query,
      fields: 'nextPageToken, files(id, name, mimeType, size, webViewLink, thumbnailLink, createdTime, modifiedTime, parents, driveId)',
      orderBy: 'modifiedTime desc'
    };

    // If driveId is provided (for shared drives), add corpora and driveId
    if (driveId) {
      requestOptions.corpora = 'drive';
      requestOptions.driveId = driveId;
      requestOptions.includeItemsFromAllDrives = true;
      requestOptions.supportsAllDrives = true;
    } else if (driveType === 'shared') {
      // List all files from all shared drives
      requestOptions.corpora = 'allDrives';
      requestOptions.includeItemsFromAllDrives = true;
      requestOptions.supportsAllDrives = true;
    } else {
      // Default to user's personal drive
      requestOptions.corpora = 'user';
    }

    const response = await drive.files.list(requestOptions);

    res.json({
      files: response.data.files || [],
      nextPageToken: response.data.nextPageToken || null
    });
  } catch (error) {
    console.error('Error listing Drive files:', error);
    res.status(500).json({
      error: 'Failed to list Drive files',
      message: error.message
    });
  }
};

// Attach Gmail email(s) to task
const attachEmailToTask = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId, messageIds } = req.body; // messageIds can be array or single string

    if (!taskId || !messageIds) {
      return res.status(400).json({
        error: 'Task ID and message ID(s) are required'
      });
    }

    // Check if user has access to the task
    const taskCheck = await pool.query(
      `SELECT t.id FROM tasks t
       INNER JOIN projects p ON t.project_id = p.id
       LEFT JOIN project_members pm ON p.id = pm.project_id
       WHERE t.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)`,
      [taskId, userId]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Task not found or access denied'
      });
    }

    // Convert to array if single messageId provided
    const messageIdArray = Array.isArray(messageIds) ? messageIds : [messageIds];

    // Get email metadata from Gmail API
    const auth = await getUserOAuth2Client(userId);
    const gmail = google.gmail({ version: 'v1', auth });

    const attachedEmails = [];

    for (const messageId of messageIdArray) {
      try {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'metadata',
          metadataHeaders: ['From', 'To', 'Subject', 'Date']
        });

        const headers = detail.data.payload.headers;
        const message = detail.data;

        const subject = headers.find(h => h.name === 'Subject')?.value || '';
        const from = headers.find(h => h.name === 'From')?.value || '';
        const to = headers.find(h => h.name === 'To')?.value || '';
        const dateStr = headers.find(h => h.name === 'Date')?.value || '';

        // Check if email has attachments
        const hasAttachments = message.payload.parts
          ? message.payload.parts.some(part => part.filename && part.filename.length > 0)
          : false;

        // Parse date
        let emailDate = null;
        if (dateStr) {
          try {
            emailDate = new Date(dateStr);
          } catch (e) {
            console.error('Error parsing date:', e);
          }
        }

        // Save to database
        const result = await pool.query(
          `INSERT INTO task_emails (
            task_id, message_id, thread_id, subject, sender,
            recipient, email_date, snippet, has_attachments, attached_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (task_id, message_id) DO NOTHING
          RETURNING *`,
          [
            taskId,
            message.id,
            message.threadId,
            subject,
            from,
            to,
            emailDate,
            message.snippet,
            hasAttachments,
            userId
          ]
        );

        if (result.rows.length > 0) {
          attachedEmails.push(result.rows[0]);
        }
      } catch (err) {
        console.error(`Error attaching email ${messageId}:`, err);
      }
    }

    res.status(201).json({
      emails: attachedEmails,
      count: attachedEmails.length
    });
  } catch (error) {
    console.error('Error attaching emails to task:', error);
    res.status(500).json({
      error: 'Failed to attach emails',
      message: error.message
    });
  }
};

// Get emails attached to a task
const getTaskEmails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { taskId } = req.params;

    // Check if user has access to the task
    const taskCheck = await pool.query(
      `SELECT t.id FROM tasks t
       INNER JOIN projects p ON t.project_id = p.id
       LEFT JOIN project_members pm ON p.id = pm.project_id
       WHERE t.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)`,
      [taskId, userId]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Task not found or access denied'
      });
    }

    const result = await pool.query(
      `SELECT e.*, u.name as attached_by_name, u.email as attached_by_email
       FROM task_emails e
       LEFT JOIN users u ON e.attached_by = u.id
       WHERE e.task_id = $1
       ORDER BY e.email_date DESC`,
      [taskId]
    );

    res.json({ emails: result.rows });
  } catch (error) {
    console.error('Error getting task emails:', error);
    res.status(500).json({
      error: 'Failed to get task emails',
      message: error.message
    });
  }
};

// Delete email attachment
const deleteTaskEmail = async (req, res) => {
  try {
    const userId = req.user.id;
    const { emailId } = req.params;

    // Check if user has access to the task
    const result = await pool.query(
      `DELETE FROM task_emails e
       USING tasks t, projects p
       LEFT JOIN project_members pm ON p.id = pm.project_id
       WHERE e.id = $1
       AND e.task_id = t.id
       AND t.project_id = p.id
       AND (p.owner_id = $2 OR pm.user_id = $2)
       RETURNING e.id`,
      [emailId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Email attachment not found or access denied'
      });
    }

    res.json({ message: 'Email attachment deleted successfully' });
  } catch (error) {
    console.error('Error deleting email attachment:', error);
    res.status(500).json({
      error: 'Failed to delete email attachment',
      message: error.message
    });
  }
};

module.exports = {
  getContacts,
  searchContacts,
  getGmailMessages,
  getGmailMessage,
  attachDriveFile,
  listDriveFiles,
  listSharedDrives,
  attachEmailToTask,
  getTaskEmails,
  deleteTaskEmail
};
