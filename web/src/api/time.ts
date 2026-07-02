export type Timestamp = {
  seconds: bigint;
  nanos: number;
};

export function timestampFromDate(date: Date): Timestamp {
  const millis = date.getTime();
  return {
    seconds: BigInt(Math.floor(millis / 1000)),
    nanos: (millis % 1000) * 1_000_000,
  };
}

export function timestampDate(timestamp?: Timestamp): Date {
  if (!timestamp) return new Date(0);
  return new Date(Number(timestamp.seconds) * 1000 + Math.floor(timestamp.nanos / 1_000_000));
}
