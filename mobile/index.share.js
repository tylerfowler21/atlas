import { registerRootComponent } from "expo";
import ShareTarget from "./src/share-target";

// The name the extension looks for. Registered separately from the app: this
// runs inside the share sheet, in its own process, with a few megabytes of
// memory and no navigation.
registerRootComponent(ShareTarget);
