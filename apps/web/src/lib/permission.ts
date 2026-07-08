import { ReactiveMap } from "@kobalte/utils";
import { type Accessor, createSignal } from "solid-js";
import { isServer } from "solid-js/web";

type PermissionInput =
  | PermissionDescriptor
  | PermissionName
  | "microphone"
  | "camera";

const cache = new ReactiveMap<string, Accessor<PermissionState | "unknown">>();

const cacheKey = (name: PermissionInput): string =>
  typeof name === "string" ? name : JSON.stringify(name);

/**
 * Querying the permission API
 *
 * Memoized per permission name at module scope, so the first caller triggers
 * the underlying `navigator.permissions.query` (and any Firefox getUserMedia
 * wrapping) once, and later callers — including dialogs that mount after a
 * permission has already been granted — receive the current state immediately
 * instead of starting at "unknown".
 *
 * @param name permission name (e.g. "microphone") or a PermissionDescriptor object (`{ name: ... }`)
 * @returns "unknown" | "denied" | "granted" | "prompt"
 */
export const createPermission = (
  name: PermissionInput,
): Accessor<PermissionState | "unknown"> => {
  if (isServer) {
    return () => "unknown";
  }
  const key = cacheKey(name);
  const cached = cache.get(key);
  if (cached) return cached;

  const [permission, setPermission] = createSignal<PermissionState | "unknown">(
    "unknown",
  );
  cache.set(key, permission);

  if (!navigator) return permission;

  const descriptor = typeof name === "string" ? { name } : name;

  navigator.permissions
    .query(descriptor)
    .then((status) => {
      setPermission(status.state);
      status.addEventListener("change", () => setPermission(status.state));
    })
    .catch((error) => {
      if (
        error.name !== "TypeError" ||
        (name !== "microphone" && name !== "camera")
      ) {
        return;
      }
      // firefox will not allow us to read media permissions,
      // so we need to wrap getUserMedia in order to get them:
      // TODO: only set to prompt if devices are available
      setPermission("prompt");
      const constraint = name === "camera" ? "video" : "audio";
      const getUserMedia = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices,
      );
      navigator.mediaDevices.getUserMedia = (constraints) =>
        constraints?.[constraint]
          ? getUserMedia(constraints)
              .then((stream: MediaStream) => {
                setPermission("granted");
                return stream;
              })
              .catch((error: DOMException) => {
                if (/not allowed/.test(error.message)) {
                  setPermission("denied");
                }
                return Promise.reject(error);
              })
          : getUserMedia(constraints);
    });

  if (name === "microphone") {
    navigator.mediaDevices.addEventListener("devicechange", () => {
      navigator.permissions
        .query(descriptor)
        .then((status) => setPermission(status.state));
    });
  }

  return permission;
};
