// Daily edition timing is shared by the worker, publication window and reader-facing copy.
// Hours are in Asia/Shanghai. Weekly and monthly schedules retain the framework defaults.
export const DAILY_REPORT_HOUR = 9;
export const DAILY_REPORT_TIME = `${String(DAILY_REPORT_HOUR).padStart(2, "0")}:00`;
