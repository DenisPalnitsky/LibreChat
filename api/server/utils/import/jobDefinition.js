const { getImporter } = require('./importers');
const { logger } = require('~/config');
const jobScheduler = require('~/server/utils/jobScheduler');
const { getAllConvos } = require('~/models/Conversation');
const { getMessages } = require('~/models');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;

const IMPORT_CONVERSATION_JOB_NAME = 'import conversation';
const EXPORT_CONVERSATION_JOB_NAME = 'export conversation';

// Define the import job function
const importConversationJob = async (job, done) => {
  const { data, requestUserId } = job.attrs.data;
  try {
    logger.info('Importing conversation...');
    const jsonData = JSON.parse(data);
    const importer = getImporter(jsonData);
    await importer(jsonData, requestUserId);
    logger.info('Finished importing conversations');
    done();
  } catch (error) {
    logger.error('Failed to import conversation: ', error);
    done(error);
  }
};

async function createAndDeleteTempFile(content, delay, jobId) {
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `export-${jobId}`);

  try {
    // Write content to the temporary file using fs.promises API
    await fs.writeFile(tempFilePath, JSON.stringify(content));
    console.log(`Temporary file created at: ${tempFilePath}`);

    // Schedule the deletion of the temporary file
    setTimeout(async () => {
      try {
        // Delete the file using fs.promises API
        await fs.unlink(tempFilePath);
        console.log(`Temporary file deleted: ${tempFilePath}`);
      } catch (error) {
        console.error('Error deleting the temporary file:', error);
      }
    }, delay);

    return tempFilePath;
  } catch (error) {
    console.error('Error handling the temporary file:', error);
  }
}

// Define the export job function
const exportConversationJob = async (job, done) => {
  const { requestUserId } = job.attrs.data;
  try {
    const convos = await getAllConvos(requestUserId);
    //const content = req.file.buffer.toString();
    //const job = await jobScheduler.now(EXPORT_CONVERSATION_JOB_NAME, content, req.user.id);

    logger.info('Convos: ' + JSON.stringify(convos));

    for (let i = 0; i < convos.conversations.length; i++) {
      const conversationId = convos.conversations[i].conversationId;
      convos.conversations[i].messages = await getMessages({ conversationId });
    }
    createAndDeleteTempFile(convos, 5 * 60 * 1000, job.attrs._id);
    done();
  } catch (error) {
    logger.error('Failed to export conversation: ', error);
    done(error);
  }
};

// Call the jobScheduler.define function at startup
jobScheduler.define(IMPORT_CONVERSATION_JOB_NAME, importConversationJob);
jobScheduler.define(EXPORT_CONVERSATION_JOB_NAME, exportConversationJob);

module.exports = { IMPORT_CONVERSATION_JOB_NAME, EXPORT_CONVERSATION_JOB_NAME };
