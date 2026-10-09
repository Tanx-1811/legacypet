// Node-only helpers for the LegacyPet app (repos on this computer). Kept out of
// src/index.js, which also runs in the browser.
export { adoptLocal, findReadme, gitHint, publishAdoption, readWorkflow, workflowOptions, ADOPT_MESSAGE } from './adopt.js';
export { communityHealth, git, guessLanguage, readRepo } from './git.js';
export { attention, createProjects, findToken } from './projects.js';
export { findRepos, suggestFolders } from './scan.js';
export { createStore, dataDir, DEFAULT_CONFIG, projectId } from './store.js';
