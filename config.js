const VIEW_TIME_MS = (hours) => ((hours * 60) + 1) * 60 * 1000; // add 1 minute to the hours
const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
export { VIEW_TIME_MS, POLL_INTERVAL_MS };
