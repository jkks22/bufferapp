import '@testing-library/jest-dom'
import 'fake-indexeddb/auto'

// jsdom 29 localStorage polyfill
const localStorageData = {}
const localStorageMock = {
  getItem: (key) => localStorageData[key] ?? null,
  setItem: (key, value) => { localStorageData[key] = String(value) },
  removeItem: (key) => { delete localStorageData[key] },
  clear: () => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]) },
  get length() { return Object.keys(localStorageData).length },
  key: (i) => Object.keys(localStorageData)[i] ?? null,
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

// jsdom no implementa scrollIntoView
if (typeof window !== 'undefined') {
  window.HTMLElement.prototype.scrollIntoView = () => {}
}
