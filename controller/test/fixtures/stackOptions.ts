// Raw STACK list-read replies for the tool.options parsers (06-02). The golden
// literals are copied value for value from the STACK automation layer's golden
// reply files (deviceTree, robotStates, labwareProfiles, transferProfiles,
// readFailed); nothing is imported from that repository. The builders produce
// replies of an exact size for the cap boundary tests.

export const ROBOT_STATES_GOLDEN = {
  kind: "robotStates",
  robots: [{ robotName: "stack2-6", state: "idle" }],
};

export const LABWARE_PROFILES_GOLDEN = {
  kind: "labwareProfiles",
  profiles: [
    {
      name: "Default",
      gripPosition: 10.2,
      gripForce: 500.0,
      plateAndLidHeight: 0.0,
      lidHeight: 0.0,
      lidGrippingPosition: 0.0,
      lidGrippingForce: 600.0,
      hasLid: false,
    },
  ],
};

export const TRANSFER_PROFILES_GOLDEN = {
  kind: "transferProfiles",
  profiles: [
    {
      name: "Default",
      fields: {
        horizontalVelocity: 200.0,
        horizontalAcceleration: 400.0,
        angularVelocity: 180.0,
        angularAcceleration: 360.0,
      },
    },
  ],
};

export const DEVICE_TREE_GOLDEN = {
  kind: "deviceTree",
  deviceCount: 1,
  devices: [
    {
      deviceName: "nest-1",
      deviceMarker: "nest-one",
      decks: [
        {
          deckName: "deck1",
          deckMarker: "deck-one",
          isCalibrated: true,
          nests: [
            {
              nestName: "A1",
              unifiedName: "deck1,A1",
              type: "Nest",
              approachName: "front",
              nestOrientation: "landscapeA1Top",
              allowedApproachDirections: ["front", "left"],
              isCalibrated: true,
            },
          ],
        },
      ],
    },
  ],
  ambiguous: [],
  apiVersion: "3",
};

export const READ_FAILED_GOLDEN = {
  kind: "readFailed",
  error: {
    status: 400,
    name: "taskNotFound",
    family: "transferState",
    code: 1,
    detail: "Plate transfer task with guid: 00000000-0000-0000-0000-000000000000 is not found",
  },
};

// Variant: duplicate names are carried as sent (the instrument is the authority).
export const ROBOT_STATES_DUPLICATES = {
  kind: "robotStates",
  robots: [
    { robotName: "stack2-6", state: "idle" },
    { robotName: "stack2-6", state: "busy" },
  ],
};

// Variant: null markers and unknown extra keys at every level.
export const DEVICE_TREE_NULL_MARKERS = {
  kind: "deviceTree",
  deviceCount: 1,
  futureField: { nested: true },
  devices: [
    {
      deviceName: "nest-1",
      deviceMarker: null,
      somethingNew: 42,
      decks: [
        {
          deckName: "deck1",
          deckMarker: null,
          isCalibrated: true,
          extra: "x",
          nests: [{ nestName: "A1", unifiedName: null, isCalibrated: false, extra: [1, 2] }],
        },
      ],
    },
  ],
  ambiguous: [],
  apiVersion: "3",
};

export function robotStatesOf(names: unknown[]): { kind: string; robots: unknown[] } {
  return { kind: "robotStates", robots: names.map((robotName) => ({ robotName, state: "idle" })) };
}

export function robotStatesWithCount(count: number): { kind: string; robots: unknown[] } {
  const robots: unknown[] = [];
  for (let i = 0; i < count; i++) {
    robots.push({ robotName: `robot-${i}`, state: "idle" });
  }
  return { kind: "robotStates", robots };
}

export function profilesWithCount(
  kind: "labwareProfiles" | "transferProfiles",
  count: number,
): { kind: string; profiles: unknown[] } {
  const profiles: unknown[] = [];
  for (let i = 0; i < count; i++) {
    profiles.push({ name: `profile-${i}` });
  }
  return { kind, profiles };
}

// A device tree of exactly `devices` devices, each with one deck holding
// `nestsPerDeck` nests: devices * (2 + nestsPerDeck) nodes in total.
export function deviceTreeWithShape(
  devices: number,
  nestsPerDeck: number,
): { kind: string; devices: unknown[]; ambiguous: string[] } {
  const out: unknown[] = [];
  for (let d = 0; d < devices; d++) {
    const nests: unknown[] = [];
    for (let n = 0; n < nestsPerDeck; n++) {
      nests.push({ nestName: `N${n}`, isCalibrated: true });
    }
    out.push({
      deviceName: `device-${d}`,
      decks: [{ deckName: "deck1", isCalibrated: true, nests }],
    });
  }
  return { kind: "deviceTree", devices: out, ambiguous: [] };
}

// A device tree with exactly `total` nodes (devices + decks + nests), total >= 2:
// one device, one deck, total - 2 nests.
export function deviceTreeWithNodeCount(total: number): {
  kind: string;
  devices: unknown[];
  ambiguous: string[];
} {
  return deviceTreeWithShape(1, total - 2);
}
