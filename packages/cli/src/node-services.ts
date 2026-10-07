// Deep imports from @effect/platform-node-shared on purpose: the package
// barrel (and @effect/platform-node) also load modules envsec never uses,
// such as ws, undici and redis, which cost install size and startup time.
import { layer as childProcessSpawnerLayer } from "@effect/platform-node-shared/NodeChildProcessSpawner";
import { layer as cryptoLayer } from "@effect/platform-node-shared/NodeCrypto";
import { layer as fileSystemLayer } from "@effect/platform-node-shared/NodeFileSystem";
import { layer as pathLayer } from "@effect/platform-node-shared/NodePath";
import { layer as stdioLayer } from "@effect/platform-node-shared/NodeStdio";
import { layer as terminalLayer } from "@effect/platform-node-shared/NodeTerminal";
import { Layer } from "effect";

export { runMain } from "@effect/platform-node-shared/NodeRuntime";

/** Equivalent to `NodeServices.layer` from @effect/platform-node. */
export const nodeServicesLayer = Layer.provideMerge(
  childProcessSpawnerLayer,
  Layer.mergeAll(
    fileSystemLayer,
    cryptoLayer,
    pathLayer,
    stdioLayer,
    terminalLayer
  )
);
