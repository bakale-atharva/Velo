import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Starts upcoming cycles and completes ended ones, carrying unfinished issues over.
crons.interval("cycle rollover", { minutes: 15 }, internal.cycles.rollover, {});

export default crons;
