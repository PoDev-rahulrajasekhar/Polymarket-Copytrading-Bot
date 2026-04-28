/** Minimal logger (replaces unpublished `wrapped-logger-utils` dependency). */
const logger = {
    info(...args: unknown[]): void {
        console.log(...args);
    },
    warn(...args: unknown[]): void {
        console.warn(...args);
    },
    error(...args: unknown[]): void {
        console.error(...args);
    },
};

export default logger;
