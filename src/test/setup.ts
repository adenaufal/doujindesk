import '@testing-library/jest-dom/vitest'
// jsdom ships no IndexedDB, and the offline scan queue lives in it.
import 'fake-indexeddb/auto'
