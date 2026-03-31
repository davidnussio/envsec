import { Electroview } from "electrobun/view";
import type { EnvsecRPC } from "../shared/types";

const rpc = Electroview.defineRPC<EnvsecRPC>({
  handlers: {
    requests: {},
    messages: {
      secretsChanged: ({ context }) => {
        window.dispatchEvent(
          new CustomEvent("secrets-changed", { detail: { context } })
        );
      },
    },
  },
});

const electroview = new Electroview({ rpc });

export { electroview };
