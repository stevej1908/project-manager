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

// List Drive files
const listDriveFiles = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pageSize = 20, pageToken, q } = req.query;

    const auth = await getUserOAuth2Client(userId);
    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.list({
      pageSize: parseInt(pageSize),
      pageToken,
      q: q || "trashed=false",
      fields: 'nextPageToken, files(id, name, mimeType, size, webViewLink, thumbnailLink, createdTime, modifiedTime)',
      orderBy: 'modifiedTime desc'
    });

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

module.exports = {
  getContacts,
  searchContacts,
  getGmailMessages,
  getGmailMessage,
  attachDriveFile,
  listDriveFiles
};
