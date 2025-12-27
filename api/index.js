// Vercel Serverless Function Entry Point
// This wraps the Express server for Vercel deployment

const app = require('../server/server');

// Export the Express app as a Vercel serverless function
module.exports = app;
