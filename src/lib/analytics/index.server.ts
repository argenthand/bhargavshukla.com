// The analytics domain's server interface. Import from here, not from the files behind it.
export { contactEvent, handleBeacon, recordServerEvent } from './server/events';
export type { EventsDataset } from './server/events';
export { readCounts, recordRead } from './server/reads';
export type { ReadsDb, ReadTarget } from './server/reads';
