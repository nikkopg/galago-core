// Parsed stack.devices trees ({ devices, ambiguous }, the shape parseDeviceTree
// returns) for the client cascade tests (06-03). GOLDEN_TREE copies the STACK
// automation layer's golden deviceTree reply value for value; the variants pin
// duplicates, "/" collisions, calibration and empty devices. Ambiguous strings
// use the adapter's exact bare "/" join (knowledge.py from_devices): a
// duplicated device lists "device", a duplicated deck "device/deck", a
// duplicated nest inside one deck "device/deck/nest".
import type { StackDevice } from "@/server/toolOptions";

export interface DeviceTreeFixture {
  devices: StackDevice[];
  ambiguous: string[];
}

export const GOLDEN_TREE: DeviceTreeFixture = {
  devices: [
    {
      deviceName: "nest-1",
      decks: [
        {
          deckName: "deck1",
          isCalibrated: true,
          nests: [{ nestName: "A1", isCalibrated: true }],
        },
      ],
    },
  ],
  ambiguous: [],
};

// Two top-level rows named "dev" (index 0 and 2) around an unrelated device.
export const DUPLICATE_DEVICE_TREE: DeviceTreeFixture = {
  devices: [
    {
      deviceName: "dev",
      decks: [
        {
          deckName: "deckA",
          isCalibrated: true,
          nests: [{ nestName: "N1", isCalibrated: true }],
        },
      ],
    },
    {
      deviceName: "other",
      decks: [
        {
          deckName: "deckO",
          isCalibrated: true,
          nests: [{ nestName: "O1", isCalibrated: true }],
        },
      ],
    },
    {
      deviceName: "dev",
      decks: [
        {
          deckName: "deckB",
          isCalibrated: true,
          nests: [{ nestName: "N2", isCalibrated: true }],
        },
      ],
    },
  ],
  ambiguous: ["dev"],
};

// "deckA" twice inside one device; neither deck lists a nest path as ambiguous.
export const DUPLICATE_DECK_TREE: DeviceTreeFixture = {
  devices: [
    {
      deviceName: "dev",
      decks: [
        {
          deckName: "deckA",
          isCalibrated: true,
          nests: [{ nestName: "N1", isCalibrated: true }],
        },
        {
          deckName: "deckA",
          isCalibrated: true,
          nests: [{ nestName: "N2", isCalibrated: true }],
        },
        {
          deckName: "deckC",
          isCalibrated: true,
          nests: [{ nestName: "N3", isCalibrated: true }],
        },
      ],
    },
  ],
  ambiguous: ["dev/deckA"],
};

// "N1" twice inside deckA; "N2" is unique.
export const DUPLICATE_NEST_TREE: DeviceTreeFixture = {
  devices: [
    {
      deviceName: "dev",
      decks: [
        {
          deckName: "deckA",
          isCalibrated: true,
          nests: [
            { nestName: "N1", isCalibrated: true },
            { nestName: "N2", isCalibrated: true },
            { nestName: "N1", isCalibrated: true },
          ],
        },
      ],
    },
  ],
  ambiguous: ["dev/deckA/N1"],
};

// The same nest name under two different decks is not ambiguous.
export const SAME_NEST_DIFFERENT_DECKS_TREE: DeviceTreeFixture = {
  devices: [
    {
      deviceName: "dev",
      decks: [
        {
          deckName: "deckA",
          isCalibrated: true,
          nests: [{ nestName: "N1", isCalibrated: true }],
        },
        {
          deckName: "deckB",
          isCalibrated: true,
          nests: [{ nestName: "N1", isCalibrated: true }],
        },
      ],
    },
  ],
  ambiguous: [],
};

// Device "a/b" + deck "c" and device "a" + deck "b/c" both join to "a/b/c".
// Device "a" also has deck "b" with nest "c", whose nest path is "a/b/c" too.
export const SLASH_COLLISION_TREE: DeviceTreeFixture = {
  devices: [
    {
      deviceName: "a/b",
      decks: [
        {
          deckName: "c",
          isCalibrated: true,
          nests: [{ nestName: "n1", isCalibrated: true }],
        },
        {
          deckName: "d",
          isCalibrated: true,
          nests: [{ nestName: "n2", isCalibrated: true }],
        },
      ],
    },
    {
      deviceName: "a",
      decks: [
        {
          deckName: "b/c",
          isCalibrated: true,
          nests: [{ nestName: "n3", isCalibrated: true }],
        },
        {
          deckName: "b",
          isCalibrated: true,
          nests: [
            { nestName: "c", isCalibrated: true },
            { nestName: "e", isCalibrated: true },
          ],
        },
      ],
    },
  ],
  ambiguous: ["a/b/c"],
};

// Calibration variants: "mixed" has an uncalibrated deck and an uncalibrated
// nest; "allUncal" has decks but none calibrated; "noDecks" has no decks;
// "noCalNests" has a calibrated deck whose nests are all uncalibrated.
export const UNCALIBRATED_TREE: DeviceTreeFixture = {
  devices: [
    {
      deviceName: "mixed",
      decks: [
        {
          deckName: "calDeck",
          isCalibrated: true,
          nests: [
            { nestName: "calNest", isCalibrated: true },
            { nestName: "uncalNest", isCalibrated: false },
          ],
        },
        {
          deckName: "uncalDeck",
          isCalibrated: false,
          nests: [{ nestName: "hidden", isCalibrated: true }],
        },
      ],
    },
    {
      deviceName: "allUncal",
      decks: [
        {
          deckName: "u1",
          isCalibrated: false,
          nests: [{ nestName: "x", isCalibrated: true }],
        },
      ],
    },
    {
      deviceName: "noCalNests",
      decks: [
        {
          deckName: "d1",
          isCalibrated: true,
          nests: [{ nestName: "y", isCalibrated: false }],
        },
      ],
    },
  ],
  ambiguous: [],
};

export const EMPTY_DEVICE_TREE: DeviceTreeFixture = {
  devices: [{ deviceName: "bare", decks: [] }],
  ambiguous: [],
};

// A refreshed tree with different contents (the hydrate+refresh proof).
export const REFRESHED_TREE: DeviceTreeFixture = {
  devices: [
    {
      deviceName: "nest-2",
      decks: [
        {
          deckName: "deck9",
          isCalibrated: true,
          nests: [{ nestName: "B2", isCalibrated: true }],
        },
      ],
    },
  ],
  ambiguous: [],
};

export const NO_DEVICES_TREE: DeviceTreeFixture = { devices: [], ambiguous: [] };
