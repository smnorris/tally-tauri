import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement the Blob URL APIs. downloadCSV() in App.jsx calls
// both; stub them so tests don't crash. Individual tests can still override
// URL.createObjectURL temporarily to inspect the Blob that was created.
if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = () => "blob:mock";
}
if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = () => {};
}
