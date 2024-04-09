const express = require('express');
const { CacheKeys } = require('librechat-data-provider');
const { initializeClient } = require('~/server/services/Endpoints/assistants');
const { getConvosByPage, deleteConvos, getConvo, saveConvo } = require('~/models/Conversation');
const requireJwtAuth = require('~/server/middleware/requireJwtAuth');
const getLogStores = require('~/cache/getLogStores');
const { sleep } = require('~/server/utils');
const { logger } = require('~/config');
const multer = require('multer');
const agenda = require('~/server/utils/import/jobScheduler');
const mongodb = require('mongodb');

const router = express.Router();
router.use(requireJwtAuth);
router.use(multer().single('file'));

router.get('/', async (req, res) => {
  let pageNumber = req.query.pageNumber || 1;
  pageNumber = parseInt(pageNumber, 10);

  if (isNaN(pageNumber) || pageNumber < 1) {
    return res.status(400).json({ error: 'Invalid page number' });
  }

  res.status(200).send(await getConvosByPage(req.user.id, pageNumber));
});

router.get('/:conversationId', async (req, res) => {
  const { conversationId } = req.params;
  const convo = await getConvo(req.user.id, conversationId);

  if (convo) {
    res.status(200).json(convo);
  } else {
    res.status(404).end();
  }
});

router.post('/gen_title', async (req, res) => {
  const { conversationId } = req.body;
  const titleCache = getLogStores(CacheKeys.GEN_TITLE);
  const key = `${req.user.id}-${conversationId}`;
  let title = await titleCache.get(key);

  if (!title) {
    await sleep(2500);
    title = await titleCache.get(key);
  }

  if (title) {
    await titleCache.delete(key);
    res.status(200).json({ title });
  } else {
    res.status(404).json({
      message: 'Title not found or method not implemented for the conversation\'s endpoint',
    });
  }
});

router.post('/clear', async (req, res) => {
  let filter = {};
  const { conversationId, source, thread_id } = req.body.arg;
  if (conversationId) {
    filter = { conversationId };
  }

  if (source === 'button' && !conversationId) {
    return res.status(200).send('No conversationId provided');
  }

  if (thread_id) {
    /** @type {{ openai: OpenAI}} */
    const { openai } = await initializeClient({ req, res });
    try {
      const response = await openai.beta.threads.del(thread_id);
      logger.debug('Deleted OpenAI thread:', response);
    } catch (error) {
      logger.error('Error deleting OpenAI thread:', error);
    }
  }

  // for debugging deletion source
  // logger.debug('source:', source);

  try {
    const dbResponse = await deleteConvos(req.user.id, filter);
    res.status(201).json(dbResponse);
  } catch (error) {
    logger.error('Error clearing conversations', error);
    res.status(500).send('Error clearing conversations');
  }
});

router.post('/update', async (req, res) => {
  const update = req.body.arg;

  try {
    const dbResponse = await saveConvo(req.user.id, update);
    res.status(201).json(dbResponse);
  } catch (error) {
    logger.error('Error updating conversation', error);
    res.status(500).send('Error updating conversation');
  }
});

// imports Json with conversation data and saves it to the database
router.post('/', async (req, res) => {
  // Read the content from formdata file and output to log
  try {
    const content = req.file.buffer.toString();
    const job = await agenda.now('import conversation', {
      data: content,
      requestUserId: req.user.id,
    });

    res.status(200).json({ message: 'Import started', jobId: job.attrs._id });
  } catch (error) {
    console.error('Error processing file', error);
    res.status(500).send('Error processing file');
  }
});

// Get the status of an import job for polling
router.get('/import/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await agenda.jobs({ _id: new mongodb.ObjectId(jobId) });
    if (!job || job.length === 0) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    if (job.length > 1) {
      // This should never happen
      return res.status(500).json({ message: 'Multiple jobs found.' });
    }
    if (job[0].attrs.data.requestUserId !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const jobDetails = {
      id: job[0]._id,
      name: job[0].attrs.name,
      status: !job[0].attrs.lastRunAt
        ? 'scheduled'
        : job[0].attrs.failedAt
          ? 'failed'
          : job[0].attrs.lastFinishedAt
            ? 'completed'
            : 'running',
    };

    res.json(jobDetails);
  } catch (error) {
    console.error('Error getting job details', error);
    res.status(500).send('Error getting job details');
  }
});

module.exports = router;
