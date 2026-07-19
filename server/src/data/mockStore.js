// Deterministic, seeded mock data layer.
//
// There is no real stadium feed for a hackathon demo, so every "live" value
// here is derived from a stable hash of its inputs instead of Math.random().
// Same input -> same output, every run, which makes the tools testable and
// keeps the demo internally consistent (Gate C is always busier than Gate A).
//
// Swapping this file for a real telemetry/transport/ticketing API later
// should not require changing anything in tools/ or server logic — keep the
// same return shapes.

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pick(seedStr, options) {
  return options[hash(seedStr) % options.length];
}

export const VENUE = {
  name: "MetLife Stadium",
  city: "East Rutherford, NJ",
  capacity: 82500,
};

export const GATES = ["A", "B", "C", "D", "E", "F", "G", "H"];

export const MATCHES = [
  { id: "m1", teams: "Argentina vs Brazil", date: "2026-07-19", time: "15:00", venue: VENUE.name, gates: ["A", "B", "C"] },
  { id: "m2", teams: "USA vs Mexico", date: "2026-07-19", time: "19:00", venue: VENUE.name, gates: ["D", "E", "F"] },
  { id: "m3", teams: "France vs Germany", date: "2026-07-20", time: "16:00", venue: VENUE.name, gates: ["A", "B", "C", "D"] },
];

// In-memory incident log (resets on server restart — fine for a demo).
export const INCIDENT_LOG = [];
let incidentCounter = 1000;

export function nextIncidentId() {
  incidentCounter += 1;
  return `INC-${incidentCounter}`;
}

export function crowdLevelFor(gate) {
  const level = pick(`crowd-${gate}`, ["low", "medium", "high", "critical"]);
  const waitByLevel = { low: 3, medium: 9, high: 18, critical: 30 };
  return {
    gate,
    level,
    waitMinutes: waitByLevel[level] + (hash(gate) % 4),
    lastUpdated: new Date().toISOString(),
  };
}

export function transportStatusFor(mode, route) {
  const status = pick(`${mode}-${route}`, ["on-time", "minor-delay", "major-delay", "on-time"]);
  const delay = { "on-time": 0, "minor-delay": 6, "major-delay": 22 }[status];
  return {
    mode,
    route,
    status,
    delayMinutes: delay,
    nextDeparture: `${8 + (hash(route) % 6)} min`,
  };
}

export function weatherFor(venue) {
  const condition = pick(`wx-${venue}`, ["clear", "partly cloudy", "hot & humid", "light rain"]);
  const temp = 24 + (hash(venue) % 12);
  return {
    venue,
    condition,
    tempC: temp,
    heatAdvisory: temp >= 32,
    windAdvisory: condition === "light rain" && hash(venue) % 2 === 0,
  };
}

export function accessibleAmenitiesFor(location) {
  return {
    location,
    accessibleRestrooms: 2 + (hash(`rr-${location}`) % 3),
    elevators: hash(`el-${location}`) % 2 === 0 ? "operational" : "operational (1 of 2, other under maintenance)",
    accessibleSeatingAvailable: hash(`seat-${location}`) % 3 !== 0,
    sensoryRoom: hash(`sr-${location}`) % 4 === 0 ? "available, ask any staff member" : "not at this location",
  };
}

export const LOST_FOUND_LOG = [
  { item: "blue jacket", location: "Gate C concourse", loggedAt: "2026-07-19T13:10:00Z" },
  { item: "child's water bottle", location: "Section 112", loggedAt: "2026-07-19T13:45:00Z" },
];
