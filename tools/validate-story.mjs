import { loadLibrary } from '../lib/library.mjs';

try {
  const library = loadLibrary();
  const story = library.get('consider-the-consequences');
  if (!story) throw new Error('Consider the Consequences! is not imported.');
  if (story.report.endings !== 43) throw new Error(`Release requires 43 endings, not ${story.report.endings}.`);
  console.log(JSON.stringify({ status: 'PASS', stories: [...library.values()].map(s => ({ id: s.id, version: s.version, ...s.report })) }, null, 2));
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
