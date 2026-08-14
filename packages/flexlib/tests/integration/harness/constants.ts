/**
 * Fixed identities used by the integration suite.
 *
 * GUI client IDs are persisted by the radio (it keys per-client settings on
 * them), so tests must NOT let the radio mint a fresh ID every session — that
 * would litter the radio with abandoned client records. Every GUI connection
 * made by this suite reuses one of these fixed IDs.
 */

/** Program name announced to the radio by every suite connection. */
export const TEST_PROGRAM = "SolidSDR-IT";

/** Station name announced by GUI connections. */
export const TEST_STATION = "SolidSDR-IT";

/** Primary GUI client ID for tests that need a GUI connection. */
export const TEST_GUI_CLIENT_ID = "5011d5d0-7e57-4000-8000-000000000001";

/** Secondary GUI client ID for multiflex tests (second simultaneous GUI). */
export const TEST_GUI_CLIENT_ID_2 = "5011d5d0-7e57-4000-8000-000000000002";

/** Tertiary GUI client ID, reserved for future multiflex scenarios. */
export const TEST_GUI_CLIENT_ID_3 = "5011d5d0-7e57-4000-8000-000000000003";

/** Default FlexRadio TCP command port. */
export const DEFAULT_RADIO_PORT = 4992;
